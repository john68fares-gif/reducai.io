// components/voice/steps/StepV2Telephony.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  KeyRound,
  RefreshCw,
  Phone,
  ArrowLeft,
  ArrowRight,
  Link as LinkIcon,
  Search,
  ChevronDown,
} from 'lucide-react';

/* ---------- shared style (matches your Builder) ---------- */
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  borderRadius: 28,
  boxShadow:
    '0 18px 60px rgba(0,0,0,0.50), inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

type Props = { onBack?: () => void; onNext?: () => void };
type NumberItem = { id: string; e164?: string; label?: string; provider?: string; status?: string };

const E164 = /^\+[1-9]\d{1,14}$/;

/* =======================================================================
   STEP 2 — TELEPHONY (Styled “From Number” dropdown; no native <select>)
======================================================================= */
export default function StepV2Telephony({ onBack, onNext }: Props) {
  const [sid, setSid] = useState('');
  const [token, setToken] = useState('');
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [fromE164, setFrom] = useState('');
  const [busyMap, setBusyMap] = useState<Record<string, string>>({}); // number -> agentId
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // restore creds
    try {
      const c = JSON.parse(localStorage.getItem('telephony:twilioCreds') || 'null');
      if (c?.accountSid) setSid(c.accountSid);
      if (c?.authToken) setToken(c.authToken);
    } catch {}
    // restore selection
    try {
      const s2 = JSON.parse(localStorage.getItem('voicebuilder:step2') || 'null');
      if (s2?.fromE164) setFrom(s2.fromE164);
    } catch {}
    // bindings
    try { setBusyMap(JSON.parse(localStorage.getItem('voice:numberBindings') || '{}')); } catch {}
    // load numbers
    refreshNumbers();
  }, []);

  async function refreshNumbers() {
    try {
      const r = await fetch('/api/telephony/phone-numbers', { cache: 'no-store' });
      const j = await r.json();
      const list: NumberItem[] = j?.ok ? j.data : j;
      setNumbers(Array.isArray(list) ? list : []);
    } catch {
      setNumbers([]);
    }
  }

  function saveCreds() {
    const accountSid = (sid || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const authToken = (token || '').trim();
    if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
      alert('Invalid Account SID (must start with AC… and be 34 chars)');
      return;
    }
    if (!authToken) {
      alert('Missing Auth Token');
      return;
    }
    try {
      localStorage.setItem('telephony:twilioCreds', JSON.stringify({ accountSid, authToken }));
      setSid(accountSid);
      setToken(authToken);
      alert('Saved to your browser.');
    } catch {}
  }

  function persistAndNext() {
    if (!E164.test(fromE164)) {
      alert('Choose a valid E.164 number, e.g. +15551234567');
      return;
    }
    if (busyMap[fromE164]) {
      alert(`This number is already attached to agent ${busyMap[fromE164]}. Choose another.`);
      return;
    }
    try { localStorage.setItem('voicebuilder:step2', JSON.stringify({ fromE164 })); } catch {}
    onNext?.();
  }

  const options = useMemo(
    () =>
      numbers.map((n) => ({
        value: n.e164 || '',
        label:
          (n.e164 || n.id || '').trim() +
          (n.label ? ` — ${n.label}` : '') +
          (n.provider ? ` (${n.provider})` : ''),
        note: n.status ? n.status : '',
      })),
    [numbers]
  );

  return (
    <section>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold">Telephony</h1>
        <div
          className="mt-2 inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
          style={{ borderColor: 'rgba(106,247,209,0.32)', background: 'rgba(16,19,20,0.70)' }}
        >
          Step 2 of 4
        </div>
      </div>

      {/* Card */}
      <div className="relative p-6 sm:p-8 space-y-6" style={CARD_STYLE}>
        {/* glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
        />

        {/* creds row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LabeledInput
            label="Twilio Account SID"
            value={sid}
            onChange={(v) => setSid(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
            icon={<KeyRound className="w-4 h-4 text-[#6af7d1]" />}
          />
          <LabeledInput
            label="Twilio Auth Token"
            type="password"
            value={token}
            onChange={setToken}
            placeholder="••••••••••••••••"
          />
        </div>

        <button
          onClick={saveCreds}
          className="text-xs rounded-2xl border px-3 py-1"
          style={{ borderColor: 'rgba(255,255,255,0.16)' }}
        >
          Save Credentials (browser only)
        </button>

        {/* number row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">
              From Number
            </label>
            <NumberSelect
              id="from-number"
              value={fromE164}
              onChange={setFrom}
              options={options}
              placeholder={numbers.length ? '— Choose —' : 'No numbers imported'}
              icon={<Phone className="w-4 h-4 text-[#6af7d1]" />}
            />
          </div>

          <button
            onClick={refreshNumbers}
            className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm"
            style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(0,0,0,0.25)' }}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="opacity-80 text-sm leading-relaxed">
          <div className="flex items-center gap-2 mb-1">
            <LinkIcon className="w-4 h-4" /> One number → one agent
          </div>
          Numbers are exclusive to a single agent. You can re-attach later, but only one active binding at a time.
        </div>

        {/* actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            disabled={!fromE164 || loading}
            onClick={persistAndNext}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
            style={{
              background: fromE164 && !loading ? BTN_GREEN : BTN_DISABLED,
              color: '#ffffff',
              boxShadow: fromE164 && !loading ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
              filter: fromE164 && !loading ? 'none' : 'saturate(85%) opacity(0.9)',
            }}
            onMouseEnter={(e) => {
              if (!fromE164 || loading) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!fromE164 || loading) return;
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

/* ---------------------- inputs ---------------------- */
function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  type?: 'text' | 'password';
}) {
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none"
        style={{ borderColor: '#13312b', boxShadow: '0 8px 34px rgba(0,0,0,0.25)' }}
      >
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[15px] text-white/95"
        />
      </div>
    </div>
  );
}

/* ---------------------- styled dropdown (portal) ---------------------- */
function NumberSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  icon,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; note?: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [query, setQuery] = useState('');

  const current = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const viewH = window.innerHeight;
    const openUp = r.bottom + 320 > viewH;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        type="button"
        onClick={() => { setOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 0); }}
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-[14px] text-sm outline-none transition"
        style={{
          background: 'rgba(0,0,0,0.30)',
          border: '1px solid rgba(255,255,255,0.20)',
          boxShadow: '0 8px 34px rgba(0,0,0,0.25)',
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {icon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={portalRef}
              className="fixed z-[9999] p-3"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                background: '#101314',
                border: '1px solid rgba(255,255,255,0.30)',
                borderRadius: 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.5)',
              }}
            >
              {/* search */}
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <Search className="w-4 h-4 text-white/70" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search numbers…"
                  className="w-full bg-transparent outline-none text-sm text-white placeholder:text-white/60"
                />
              </div>

              {/* list */}
              <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {filtered.map((o) => (
                  <button
                    key={o.value || o.label}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition"
                    style={{ background: 'transparent', border: '1px solid transparent' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.10)';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.35)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                    }}
                  >
                    <Phone className="w-4 h-4 text-white/80" />
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.note ? <span className="text-white/50 text-xs">{o.note}</span> : null}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-6 text-sm text-white/70">No numbers found.</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
