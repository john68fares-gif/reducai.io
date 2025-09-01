'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, RefreshCw, Phone, ArrowLeft, ArrowRight, Link as LinkIcon, ShieldCheck,
} from 'lucide-react';

/* ---------- shared look: same as Step 1, with extra soft drop shadow ---------- */
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow:
    '0 18px 60px rgba(0,0,0,0.50), inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};

const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

type Props = { onBack?: () => void; onNext?: () => void };
type NumberItem = { id: string; e164?: string; label?: string; provider?: string; status?: string };

const E164 = /^\+[1-9]\d{1,14}$/;

export default function StepV2Telephony({ onBack, onNext }: Props) {
  const [sid, setSid] = useState('');
  const [token, setToken] = useState('');
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [fromE164, setFrom] = useState('');
  const [loadingNums, setLoadingNums] = useState(false);

  // client-side "one number → one agent" memory
  const [busyMap, setBusyMap] = useState<Record<string, string>>({}); // number -> agentId

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('telephony:twilioCreds') || 'null');
      if (c?.accountSid) setSid(c.accountSid);
      if (c?.authToken) setToken(c.authToken);
    } catch {}
    try { setBusyMap(JSON.parse(localStorage.getItem('voice:numberBindings') || '{}')); } catch {}
    try {
      const s2 = JSON.parse(localStorage.getItem('voicebuilder:step2') || 'null');
      if (s2?.fromE164) setFrom(s2.fromE164);
    } catch {}
    refreshNumbers();
  }, []);

  async function refreshNumbers() {
    setLoadingNums(true);
    try {
      // Server endpoint should return the numbers you (the platform) own,
      // so end-users DON'T have to type creds just to pick a number.
      const r = await fetch('/api/telephony/phone-numbers');
      const j = await r.json();
      const list = (j?.ok ? j.data : j) as NumberItem[];
      setNumbers(Array.isArray(list) ? list : []);
      // preselect if empty
      if (!fromE164 && Array.isArray(list) && list.length && list[0].e164) {
        setFrom(list[0].e164 as string);
      }
    } catch {
      setNumbers([]);
    } finally {
      setLoadingNums(false);
    }
  }

  function saveCreds() {
    const accountSid = (sid || '').trim();
    const authToken = (token || '').trim();
    if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) { alert('Invalid Account SID'); return; }
    if (!authToken) { alert('Missing Auth Token'); return; }
    try { localStorage.setItem('telephony:twilioCreds', JSON.stringify({ accountSid, authToken })); } catch {}
    alert('Twilio creds saved to your browser.');
  }

  function persistAndNext() {
    if (!fromE164 || !E164.test(fromE164)) { alert('Pick a valid phone number.'); return; }
    if (busyMap[fromE164]) {
      alert(`This number is already attached to agent ${busyMap[fromE164]}. Choose another.`);
      return;
    }
    try { localStorage.setItem('voicebuilder:step2', JSON.stringify({ fromE164 })); } catch {}
    onNext?.();
  }

  const alreadyBoundTo = useMemo(
    () => (fromE164 && busyMap[fromE164]) ? busyMap[fromE164] : '',
    [busyMap, fromE164]
  );

  return (
    <section className="relative">
      {/* Header line (matches your Step 1 vibe) */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
            style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#6af7d1]" />
            Step 2 · Model Settings
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">Telephony</h2>
          <p className="text-white/70 mt-1">Attach a phone number and (optionally) save Twilio credentials to your browser.</p>
        </div>
        <div
          className="text-xs px-3 py-1 rounded-2xl border"
          style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}
        >
          Step 2 of 4
        </div>
      </div>

      {/* Form Card */}
      <div className="relative p-6 sm:p-8" style={CARD_STYLE}>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{ background:'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter:'blur(38px)' }}
        />

        {/* Row 1: SID / TOKEN (side by side like your Step 1 grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Twilio Account SID">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#6af7d1]" />
              <input
                value={sid}
                onChange={(e) => setSid(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}
                placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full bg-transparent outline-none text-[15px] text-white/95"
              />
            </div>
          </Field>
          <Field label="Twilio Auth Token">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full bg-transparent outline-none text-[15px] text-white/95"
              type="password"
            />
          </Field>
        </div>

        <div className="mt-2">
          <button
            onClick={saveCreds}
            className="text-xs rounded-2xl border px-3 py-1"
            style={{ borderColor:'rgba(255,255,255,0.16)' }}
          >
            Save Credentials (browser only)
          </button>
        </div>

        {/* Row 2: From Number select spans the width, refresh on the right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-6 items-end">
          <div className="md:col-span-10">
            <Field label="From Number">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#6af7d1]" />
                <select
                  value={fromE164}
                  onChange={(e)=>setFrom(e.target.value)}
                  className="w-full bg-transparent outline-none text-[15px] text-white/95"
                  style={{ appearance:'none' }}
                >
                  <option value="">{loadingNums ? 'Loading…' : numbers.length ? '— Choose —' : 'No numbers available'}</option>
                  {numbers.map((n) => {
                    const e = n.e164 || '';
                    const nicelabel = [e, n.label].filter(Boolean).join(' — ');
                    return <option key={n.id} value={e}>{nicelabel}</option>;
                  })}
                </select>
              </div>
            </Field>
            {alreadyBoundTo && (
              <div className="text-xs text-amber-300 mt-2">
                This number is already attached to agent <span className="font-semibold">{alreadyBoundTo}</span>.
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <button
              onClick={refreshNumbers}
              className="w-full inline-flex items-center justify-center gap-2 rounded-[14px] border px-3 py-2 text-sm"
              style={{ borderColor:'rgba(255,255,255,0.16)', background:'rgba(16,19,20,0.88)' }}
              disabled={loadingNums}
            >
              <RefreshCw className={`w-4 h-4 ${loadingNums ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Info strip */}
        <div className="mt-6 rounded-2xl border p-4 text-sm"
             style={{ borderColor:'rgba(255,255,255,0.16)', background:'#101314', boxShadow:'0 8px 34px rgba(0,0,0,0.25)' }}>
          <div className="flex items-center gap-2 text-white font-semibold">
            <LinkIcon className="w-4 h-4 text-[#6af7d1]" /> One number → one agent
          </div>
          <div className="text-white/70 mt-1">
            Numbers are exclusive to a single agent. You can re-attach later, but only one active binding at a time.
          </div>
        </div>

        {/* Footer buttons */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            onClick={persistAndNext}
            disabled={!fromE164}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
            style={{
              background: fromE164 ? BTN_GREEN : BTN_DISABLED,
              color: '#ffffff',
              boxShadow: fromE164 ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
              filter: fromE164 ? 'none' : 'saturate(85%) opacity(0.9)',
            }}
            onMouseEnter={(e) => {
              if (!fromE164) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!fromE164) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
            }}
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ---------- small field shell with the same shadow/roundness everywhere ---------- */
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="rounded-2xl bg-[#101314] border px-3 py-2.5"
        style={{ borderColor:'#13312b', boxShadow:'0 8px 34px rgba(0,0,0,0.25)' }}
      >
        {children}
      </div>
    </div>
  );
}
