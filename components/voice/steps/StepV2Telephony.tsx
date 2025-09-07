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
import { scopedStorage } from '@/utils/scoped-storage';

/* ---------------------------------------------------------------------------
   THEME VARS (same idea as StepV1 / Step2 model)
--------------------------------------------------------------------------- */
const SCOPE_CLASS = 'voice-step2-scope';
const PORTAL_CLASS = 'voice-step2-portal';

/* Brand button (same green you use elsewhere) */
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

type Props = { onBack?: () => void; onNext?: () => void };

type NumberItem = {
  id: string;
  e164?: string;
  label?: string;
  provider?: string;
  status?: string;
};

type ApiKey = { id: string; name: string; key: string };

const E164 = /^\+[1-9]\d{1,14}$/;

// shared keys used across the app
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

export default function StepV2Telephony({ onBack, onNext }: Props) {
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [fromE164, setFrom] = useState('');
  const [busyMap, setBusyMap] = useState<Record<string, string>>({}); // e164 -> agentId
  const [loading, setLoading] = useState(false);

  // OpenAI API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState<string>('');

  /* ------------------------ bootstrap ------------------------ */
  useEffect(() => {
    // restore selection from previous step for this voice flow
    try {
      const s2 = JSON.parse(localStorage.getItem('voicebuilder:step2') || 'null');
      if (s2?.fromE164) setFrom(s2.fromE164);
      if (s2?.apiKeyId) setApiKeyId(s2.apiKeyId);
    } catch {}

    // number->agent bindings (client cache)
    try {
      setBusyMap(JSON.parse(localStorage.getItem('voice:numberBindings') || '{}'));
    } catch {}

    // load phone numbers
    refreshNumbers();

    // load OpenAI keys from scoped storage
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const v1 = await ss.getJSON<ApiKey[]>(LS_KEYS, []);
        const legacy = await ss.getJSON<ApiKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ''), name: String(k?.name || ''), key: String(k?.key || '') }))
          .filter((k) => k.id && k.name);

        setApiKeys(cleaned);

        // choose default key: previous voicebuilder choice -> global selected -> first available
        const globalSelected = await ss.getJSON<string>(LS_SELECTED, '');
        const chosen =
          (apiKeyId && cleaned.some((k) => k.id === apiKeyId)) ? apiKeyId :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || '');

        setApiKeyId(chosen);
        if (chosen) await ss.setJSON(LS_SELECTED, chosen); // keep global in sync
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optional: prune stale bindings (numbers that no longer exist)
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('voice:numberBindings') || '{}') as Record<string, string>;
      const validE164s = new Set(numbers.map((n) => n.e164).filter(Boolean) as string[]);
      const cleaned: Record<string, string> = {};
      Object.entries(raw).forEach(([e164, agentId]) => {
        if (validE164s.has(e164)) cleaned[e164] = agentId;
      });
      setBusyMap(cleaned);
      localStorage.setItem('voice:numberBindings', JSON.stringify(cleaned));
    } catch {}
  }, [numbers]);

  async function refreshNumbers() {
    setLoading(true);
    try {
      const r = await fetch('/api/telephony/phone-numbers', { cache: 'no-store' });
      const j = await r.json();
      const list: NumberItem[] = j?.ok ? j.data : j;
      setNumbers(Array.isArray(list) ? list : []);
    } catch {
      setNumbers([]);
    } finally {
      setLoading(false);
    }
  }

  function persistAndNext() {
    if (!E164.test(fromE164)) {
      alert('Choose a valid E.164 number, e.g. +15551234567');
      return;
    }
    if (!apiKeyId) {
      alert('Please select an OpenAI API key.');
      return;
    }
    if (busyMap[fromE164]) {
      alert(`This number is already attached to agent ${busyMap[fromE164]}. Choose another.`);
      return;
    }
    try {
      localStorage.setItem('voicebuilder:step2', JSON.stringify({ fromE164, apiKeyId }));
    } catch {}
    onNext?.();
  }

  const numberOptions = useMemo(
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

  const canNext = !!fromE164 && !!apiKeyId && E164.test(fromE164);

  return (
    <section className={SCOPE_CLASS}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold" style={{ color: 'var(--text)' }}>Telephony</h1>
        <div
          className="mt-2 inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
          style={{ borderColor: 'var(--vs-chip-border)', background: 'var(--vs-chip-bg)', color: 'var(--text)' }}
        >
          Step 2 of 4
        </div>
      </div>

      {/* Card */}
      <div
        className="relative p-6 sm:p-8 space-y-6 rounded-[28px]"
        style={{ background: 'var(--vs-card)', border: '1px solid var(--vs-border)', boxShadow: 'var(--vs-shadow)' }}
      >
        {/* glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--vs-ring) 0%, transparent 70%)', filter: 'blur(38px)' }}
        />

        {/* OpenAI Key row */}
        <div>
          <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
            OpenAI API Key
          </label>
          <div className="relative">
            <select
              value={apiKeyId}
              onChange={async (e) => {
                const val = e.target.value;
                setApiKeyId(val);
                try {
                  const ss = await scopedStorage();
                  await ss.ensureOwnerGuard();
                  await ss.setJSON(LS_SELECTED, val);
                } catch {}
              }}
              className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none"
              style={{
                background: 'var(--vs-input-bg)',
                border: '1px solid var(--vs-input-border)',
                boxShadow: 'var(--vs-input-shadow)',
                color: 'var(--text)',
              }}
            >
              <option value="">Select an API key…</option>
              {apiKeys.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ••••{(k.key || '').slice(-4).toUpperCase()}
                </option>
              ))}
            </select>
            <KeyRound className="w-4 h-4 absolute right-3 top-3.5 opacity-70" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            Keys are stored per-account via scoped storage. Manage them in the API Keys page.
          </div>
        </div>

        {/* number row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
              From Number
            </label>
            <NumberSelect
              id="from-number"
              value={fromE164}
              onChange={setFrom}
              options={numberOptions}
              placeholder={numbers.length ? '— Choose —' : 'No numbers imported'}
              icon={<Phone className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
            />
          </div>

          <button
            onClick={refreshNumbers}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm"
            style={{
              background: 'var(--vs-input-bg)',
              border: '1px solid var(--vs-input-border)',
              boxShadow: 'var(--vs-input-shadow)',
              color: 'var(--text)',
            }}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        <div className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text)' }}>
            <LinkIcon className="w-4 h-4" /> One number → one agent
          </div>
          <span style={{ color: 'var(--text-muted)' }}>
            Numbers are exclusive to a single agent. You can re-attach later, but only one active binding at a time.
          </span>
        </div>

        {/* actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm transition"
            style={{
              background: 'var(--vs-input-bg)',
              border: '1px solid var(--vs-input-border)',
              boxShadow: 'var(--vs-input-shadow)',
              color: 'var(--text)',
            }}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            disabled={!canNext || loading}
            onClick={persistAndNext}
            className="inline-flex items-center gap-2 px-8 h-[42px] rounded-[18px] font-semibold select-none disabled:cursor-not-allowed"
            style={{
              background: canNext && !loading ? BTN_GREEN : BTN_DISABLED,
              color: '#ffffff',
              boxShadow: canNext && !loading ? '0 10px 24px rgba(16,185,129,.25)' : 'none',
              transition: 'transform .15s ease, box-shadow .15s ease, background .15s ease',
            }}
            onMouseEnter={(e) => {
              if (!canNext || loading) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!canNext || loading) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
            }}
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Scoped theme vars for Step 2 + portal tokens */}
        <style jsx global>{`
          /* LIGHT (default) */
          .${SCOPE_CLASS}{
            --vs-card: #ffffff;
            --vs-border: rgba(0,0,0,.10);
            --vs-shadow: 0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
            --vs-ring: rgba(0,255,194,.10);

            --vs-input-bg: #ffffff;
            --vs-input-border: rgba(0,0,0,.12);
            --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 22px rgba(0,0,0,.06);

            --vs-chip-bg: rgba(0,255,194,.08);
            --vs-chip-border: rgba(0,255,194,.24);
          }

          /* DARK */
          [data-theme="dark"] .${SCOPE_CLASS}{
            --vs-card:
              radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
              linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
            --vs-border: rgba(255,255,255,.08);
            --vs-shadow: 0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10);
            --vs-ring: rgba(0,255,194,.12);

            --vs-input-bg: #101314; /* solid dark */
            --vs-input-border: rgba(255,255,255,.14);
            --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);

            --vs-chip-bg: rgba(0,255,194,.10);
            --vs-chip-border: rgba(0,255,194,.28);
          }

          /* Portal (menu) surface — explicit class so dark mode is reliable */
          .${PORTAL_CLASS}{
            --vs-menu-bg: #ffffff;
            --vs-menu-border: rgba(0,0,0,.10);
          }
          [data-theme="dark"] .${PORTAL_CLASS}{
            --vs-menu-bg: #101314;
            --vs-menu-border: rgba(255,255,255,.16);
          }
        `}</style>
      </div>
    </section>
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
          background: 'var(--vs-input-bg)',
          border: '1px solid var(--vs-input-border)',
          boxShadow: 'var(--vs-input-shadow)',
          color: 'var(--text)',
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {icon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={portalRef}
              className={`${PORTAL_CLASS} fixed z-[9999] p-3`}
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                background: 'var(--vs-menu-bg)',
                border: '1px solid var(--vs-menu-border)',
                borderRadius: 20,
                boxShadow: '0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02)',
              }}
            >
              {/* search */}
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                style={{
                  background: 'var(--vs-input-bg)',
                  border: '1px solid var(--vs-input-border)',
                  boxShadow: 'var(--vs-input-shadow)',
                  color: 'var(--text)',
                }}
              >
                <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search numbers…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
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
                    style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.10)';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.35)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                    }}
                  >
                    <Phone className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.note ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.note}</span> : null}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No numbers found.
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
