// components/voice/steps/StepV2Telephony.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, Phone, ArrowLeft, ArrowRight, Link } from 'lucide-react';
import { CARD_STYLE, GreenButton, BTN_GREEN } from '../atoms';

type Props = { onBack?: () => void; onNext?: () => void };
type NumberItem = { id: string; e164?: string; label?: string; provider?: string; status?: string };

const E164 = /^\+[1-9]\d{1,14}$/;

export default function StepV2Telephony({ onBack, onNext }: Props) {
  const [sid, setSid] = useState('');
  const [token, setToken] = useState('');
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [fromE164, setFrom] = useState('');
  const [busyMap, setBusyMap] = useState<Record<string, string>>({}); // number -> agentId

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('telephony:twilioCreds') || 'null');
      if (c?.accountSid) setSid(c.accountSid);
      if (c?.authToken) setToken(c.authToken);
    } catch {}
    refreshNumbers();
    try { setBusyMap(JSON.parse(localStorage.getItem('voice:numberBindings') || '{}')); } catch {}
    const s1 = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
    const s2 = JSON.parse(localStorage.getItem('voicebuilder:step2') || 'null');
    if (s2?.fromE164) setFrom(s2.fromE164);
    else if (s1?.fromE164) setFrom(s1.fromE164);
  }, []);

  async function refreshNumbers() {
    try {
      const r = await fetch('/api/telephony/phone-numbers');
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
      const j = await r.json();
      const list = (j?.ok ? j.data : j) as NumberItem[];
      setNumbers(Array.isArray(list) ? list : []);
    } catch {
      setNumbers([]);
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
    if (!fromE164 || !E164.test(fromE164)) { alert('Pick a valid number.'); return; }
    if (busyMap[fromE164]) {
      alert(`This number is already attached to agent ${busyMap[fromE164]}. Choose another.`);
      return;
    }
    try { localStorage.setItem('voicebuilder:step2', JSON.stringify({ fromE164 })); } catch {}
    onNext?.();
  }

  const alreadyBoundTo = useMemo(() => (fromE164 && busyMap[fromE164]) ? busyMap[fromE164] : '', [busyMap, fromE164]);

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold">Telephony</h1>
        <div className="text-xs px-3 py-1 rounded-2xl border" style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}>Step 2 of 4</div>
      </div>

      <div className="p-7 md:p-8" style={CARD_STYLE}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Labeled v={sid} set={(v)=>setSid(v.toUpperCase().replace(/[^A-Z0-9]/g,''))} label="Twilio Account SID" icon={<KeyRound className="w-4 h-4 text-[#6af7d1]" />} placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" />
          <Labeled v={token} set={setToken} label="Twilio Auth Token" placeholder="••••••••••••••••" />
        </div>
        <div className="mt-2">
          <button onClick={saveCreds} className="text-xs rounded-2xl border px-3 py-1" style={{ borderColor:'rgba(255,255,255,0.16)' }}>
            Save Credentials (browser only)
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">From Number</label>
            <div className="flex gap-2 items-center">
              <select
                value={fromE164}
                onChange={(e)=>setFrom(e.target.value)}
                className="flex-1 rounded-2xl bg-[#101314] text-white/95 border border-[#13312b] px-4 py-3.5 text-[15px] outline-none focus:border-[#00ffc2]"
              >
                <option value="">{numbers.length ? '— Choose —' : 'No numbers imported'}</option>
                {numbers.map(n => {
                  const label = (n.e164 || n.id) + (n.label ? ` — ${n.label}` : '');
                  return <option key={n.id} value={n.e164 || ''}>{label}</option>;
                })}
              </select>
              <button onClick={refreshNumbers} className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm" style={{ borderColor:'rgba(255,255,255,0.16)' }}>
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
            </div>
            {alreadyBoundTo && <div className="text-xs text-amber-300 mt-2">This number is already attached to agent <span className="font-semibold">{alreadyBoundTo}</span>.</div>}
          </div>

          <div className="opacity-80 text-sm">
            <div className="flex items-center gap-2 mb-1"><Phone className="w-4 h-4" /> One number → one agent</div>
            Numbers are exclusive to a single agent. You can re-attach later, but only one active binding at a time.
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <GreenButton onClick={persistAndNext} disabled={!fromE164}>Next <ArrowRight className="w-4 h-4" /></GreenButton>
        </div>
      </div>
    </section>
  );
}

function Labeled({ v, set, label, placeholder, icon }:{ v:string; set:(s:string)=>void; label:string; placeholder?:string; icon?:React.ReactNode }) {
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none" style={{ borderColor:'#13312b' }}>
        {icon}
        <input value={v} onChange={(e)=>set(e.target.value)} placeholder={placeholder} className="w-full bg-transparent outline-none text-[15px] text-white/95" />
      </div>
    </div>
  );
}
