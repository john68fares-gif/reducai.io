// components/phone-numbers/PhoneNumbersSection.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone as PhoneIcon, RefreshCw, Plus, Check, ShieldAlert, X, MessageSquare, RotateCw
} from 'lucide-react';
import CountryDialSelect from '@/components/phone-numbers/CountryDialSelect';

type Provider = 'twilio' | 'telnyx' | 'own';
type Status = 'active' | 'activating' | 'failed' | 'verified' | string;
type PhoneNumber = { id: string; e164?: string; label?: string; provider: Provider; status?: Status };

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: { code: string; message: string; hint?: string; details?: any } };
type Envelope<T> = Ok<T> | Err;

const CACHE_KEY = 'builder:step2Numbers';
const DRAFT_KEY = 'builder:draft';

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
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
};
const ACTIVE_CARD: React.CSSProperties = {
  boxShadow: '0 0 16px rgba(0,255,194,0.22), inset 0 0 16px rgba(0,0,0,0.30)',
  borderColor: 'rgba(0,255,194,0.45)',
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

const isE164 = (s: string) => /^\+[1-9]\d{1,14}$/.test(s);
const isTwilioSid = (s: string) => /^AC[a-zA-Z0-9]{32}$/.test(s);
const digits = (s: string) => (s || '').replace(/[^\d+]/g, '');

type Pane = 'importTwilio' | 'importTelnyx' | 'useOwn';

function readJSON<T>(k: string, fb: T): T { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as T : fb; } catch { return fb; } }
function writeJSON<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

export default function PhoneNumbersSection() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PhoneNumber[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>('importTwilio');
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});

  // Twilio form
  const [twPhone, setTwPhone] = useState(''); const [twSid, setTwSid] = useState(''); const [twToken, setTwToken] = useState(''); const [twLabel, setTwLabel] = useState('');

  // Telnyx form
  const [txPhone, setTxPhone] = useState(''); const [txKey, setTxKey] = useState(''); const [txLabel, setTxLabel] = useState('');

  // BYON + OTP
  const [ownIso2, setOwnIso2]   = useState<string>('US');
  const [ownDial, setOwnDial]   = useState<string>('1');
  const [ownPhone, setOwnPhone] = useState('');
  const [ownLabel, setOwnLabel] = useState('');

  const [otpSent, setOtpSent]   = useState(false);
  const [otpCode, setOtpCode]   = useState('');
  const [otpMeta, setOtpMeta]   = useState<{ expiresAt: number; resendAfter: number } | null>(null);
  const [nowTs, setNowTs]       = useState(Date.now());
  const verifyingRef            = useRef(false);

  // tick for countdowns
  useEffect(() => {
    if (!otpSent) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [otpSent]);

  const secondsLeft  = otpMeta ? Math.max(0, Math.ceil((otpMeta.expiresAt  - nowTs)/1000)) : 0;
  const resendIn     = otpMeta ? Math.max(0, Math.ceil((otpMeta.resendAfter - nowTs)/1000)) : 0;
  const isExpired    = otpSent && secondsLeft === 0;

  // list load / cache
  const selected = useMemo(() => items.find((i) => i.id === selectedId), [items, selectedId]);
  const continueDisabled = !selected || selected.status === 'failed';

  useEffect(() => {
    const cache = readJSON<{ items: PhoneNumber[]; lastSelectedId?: string } | null>(CACHE_KEY, null);
    if (cache?.items) setItems(cache.items);
    if (cache?.lastSelectedId) setSelectedId(cache.lastSelectedId);
    fetchList().finally(() => setLoading(false));
    return () => {};
  }, []);

  async function safeJSON<T>(res: Response): Promise<T> {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json() as Promise<T>;
    throw new Error(`${res.status} ${res.statusText} — API route not found. Make sure /api/telephony/phone-numbers.ts exists.`);
  }

  async function fetchList() {
    setError(null);
    try {
      const res  = await fetch('/api/telephony/phone-numbers');
      const json = await safeJSON<Envelope<PhoneNumber[]>>(res);
      if (!json.ok) throw new Error(json.error?.message || 'Failed to load numbers');
      setItems(json.data);
      writeJSON(CACHE_KEY, { items: json.data, lastSelectedId: selectedId });
      if (selectedId && !json.data.some((n) => n.id === selectedId)) setSelectedId(undefined);
    } catch (e: any) { setError(e?.message || 'Network error'); }
  }

  function select(id: string) {
    setSelectedId(id);
    const draft = readJSON<any>(DRAFT_KEY, {});
    const chosen = items.find((n) => n.id === id);
    writeJSON(DRAFT_KEY, { ...draft, phoneNumberId: chosen?.id, phoneNumberE164: chosen?.e164, phoneNumberProvider: chosen?.provider });
    const cache = readJSON<any>(CACHE_KEY, {});
    writeJSON(CACHE_KEY, { ...cache, lastSelectedId: id, items });
  }

  async function post<T>(body: any) {
    const res  = await fetch('/api/telephony/phone-numbers', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    const json = await safeJSON<Envelope<T>>(res);
    if (!json.ok) throw json.error;
    return json.data as T;
  }

  // === submit shared ===
  async function onSubmit() {
    setSubmitting(true); setFieldErrors({}); setBanner(null);
    try {
      if (pane === 'importTwilio') {
        const errs: Record<string,string> = {};
        if (!isE164(digits(twPhone))) errs.phone = 'Use E.164 (e.g. +15555551234).';
        if (!isTwilioSid(twSid))      errs.accountSid = 'SID must start with AC and be 34 chars.';
        if (!twToken)                 errs.authToken  = 'Auth token required.';
        if (Object.keys(errs).length) { setFieldErrors(errs); setSubmitting(false); return; }
        const data = await post<{ number: PhoneNumber }>({ action:'importTwilio', payload:{ phone: digits(twPhone), accountSid: twSid, authToken: twToken, label: twLabel || undefined } });
        const n = data.number; setItems(p => [n, ...p]); select(n.id); setOpen(false); setTwToken('');
      }
      if (pane === 'importTelnyx') {
        const errs: Record<string,string> = {};
        if (!isE164(digits(txPhone))) errs.txPhone = 'Use E.164.';
        if (!txKey)                   errs.txKey   = 'API key required.';
        if (Object.keys(errs).length) { setFieldErrors(errs); setSubmitting(false); return; }
        const data = await post<{ number: PhoneNumber }>({ action:'importTelnyx', payload:{ phone: digits(txPhone), apiKey: txKey, label: txLabel || undefined } });
        const n = data.number; setItems(p => [n, ...p]); select(n.id); setOpen(false);
      }
    } catch (e: any) {
      setBanner(e?.message || 'Request failed');
      if (e?.details?.field) setFieldErrors({ [e.details.field]: e.message });
    } finally { setSubmitting(false); }
  }

  // === OTP helpers ===
  function normalizeOwnE164(): string {
    const raw = digits(ownPhone);
    return raw.startsWith('+') ? raw : `+${ownDial}${raw}`;
  }

  async function sendOtp() {
    setSubmitting(true); setFieldErrors({}); setBanner(null);
    const e164 = normalizeOwnE164();
    if (!isE164(e164)) { setFieldErrors({ ownPhone: 'Use a valid number. Example: +15555550123' }); setSubmitting(false); return; }
    try {
      const r = await post<{ sent:boolean; mode:'mock'|'live'; expiresInSec:number; resendInSec:number }>(
        { action:'startSmsVerify', payload:{ phone: e164 } }
      );
      setOtpSent(true);
      const now = Date.now();
      setOtpMeta({ expiresAt: now + r.expiresInSec*1000, resendAfter: now + r.resendInSec*1000 });
      setOwnPhone(e164); // lock normalized
      setBanner('We sent a 6-digit code by SMS.');
      setTimeout(() => setBanner(null), 6000);
    } catch (e: any) {
      setBanner(e?.message || 'Failed to send code');
      if (e?.details?.field) setFieldErrors({ [e.details.field]: e.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp() {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setSubmitting(true); setFieldErrors({}); setBanner(null);
    try {
      const data = await post<{ number: PhoneNumber }>(
        { action:'checkSmsVerify', payload:{ phone: ownPhone, code: otpCode, label: ownLabel || undefined } }
      );
      const n = data.number; setItems(p => [n, ...p]); select(n.id); setOpen(false);
    } catch (e: any) {
      setBanner(e?.message || 'Verification failed');
      if (e?.details?.field) setFieldErrors({ [e.details.field]: e.message });
    } finally {
      verifyingRef.current = false;
      setSubmitting(false);
    }
  }

  // auto-submit when 6 digits & not expired
  useEffect(() => {
    const six = otpCode.replace(/\D/g, '');
    if (otpSent && six.length === 6 && !isExpired) verifyOtp();
  }, [otpCode, otpSent, isExpired]);

  // === UI ===
  return (
    <section className="w-full mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <PhoneIcon className="h-6 w-6 text-[#6af7d1]" />
            Phone Numbers
          </h2>
          <div className="text-white/80 text-xs md:text-sm">Import from Twilio/Telnyx, or verify your own number via SMS (worldwide).</div>
        </div>

        <div className="flex items-center gap-3">
          <GreenButton onClick={fetchList} title="Refresh numbers">
            <RefreshCw className="w-4 h-4 text-white" />
            Refresh
          </GreenButton>
          <GreenButton onClick={() => setOpen(true)} title="Add a phone number">
            <Plus className="w-4 h-4 text-white" />
            Add Number
          </GreenButton>
        </div>
      </div>

      {/* Frame */}
      <div className="relative p-6 md:p-8 overflow-hidden" style={FRAME}>
        <div className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)', filter: 'blur(38px)' }} />
        <div className="pointer-events-none absolute -bottom-[28%] -right-[28%] w-[70%] h-[70%] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)', filter: 'blur(38px)' }} />

        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-[14px] px-4 py-3 text-sm"
               style={{ ...CARD, border: '1px solid rgba(255,0,0,0.35)', background: 'rgba(255,0,0,0.08)' }}>
            <ShieldAlert className="h-4 w-4 text-red-300" />
            <span className="text-red-200">{error}</span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[160px] rounded-[20px]"
                   style={{ ...CARD, background:
                     'linear-gradient(90deg, rgba(20,24,25,0.9) 25%, rgba(28,32,33,0.95) 37%, rgba(20,24,25,0.9) 63%)',
                     backgroundSize: '200% 100%', animation: 'shimmer 1200ms linear infinite' }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 md:p-8 text-white/80 text-sm" style={{ ...CARD, boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>
            Nothing yet. Click <span className="text-white">Add Number</span> to import or verify your own.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((n) => (
              <button key={n.id} onClick={() => select(n.id)}
                      className="group relative text-left p-6 rounded-[20px] transition-all hover:-translate-y-[2px] active:translate-y-0"
                      style={{ ...CARD, ...(selectedId === n.id ? ACTIVE_CARD : {}), boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>
                <div className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity"
                     style={{ boxShadow: '0 0 34px 10px rgba(106,247,209,0.18), inset 0 0 14px rgba(106,247,209,0.18)' }} />
                <div className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 rounded-[20px] opacity-0 group-hover:opacity-10"
                     style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)', animation: 'sheen 900ms ease-out forwards' }} />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center"
                       style={{ background: 'rgba(0,0,0,0.18)', border: '2px dashed rgba(106,247,209,0.35)', boxShadow: 'inset 0 0 18px rgba(0,0,0,0.45), inset 0 0 6px rgba(106,247,209,0.06)' }}>
                    <PhoneIcon className="w-5 h-5" style={{ color: '#6af7d1', opacity: 0.9 }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold truncate">{n.label || n.e164 || 'Untitled number'}</div>
                    <div className="text-xs text-white/70 truncate">
                      {(n.e164 ? `${n.e164} · ` : '') + (n.provider === 'own' ? 'your number' : n.provider)}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-3">
                    <span className="rounded-full px-2.5 py-1 text-[11px]"
                          style={{
                            background: n.status === 'active' || n.status === 'verified' ? 'rgba(16,185,129,0.15)'
                                      : n.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color:      n.status === 'active' || n.status === 'verified' ? 'rgb(110,231,183)'
                                      : n.status === 'failed' ? 'rgb(252,165,165)' : 'rgb(253,230,138)',
                            border: '1px solid rgba(255,255,255,0.16)'
                          }}>
                      {n.status}
                    </span>
                    <input type="radio" name="activeNumber" checked={selectedId === n.id} onChange={() => select(n.id)} className="h-4 w-4 accent-[#6af7d1]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs md:text-sm text-white/70">Selection saves automatically to <code>builder:draft</code>.</p>
        <GreenButton disabled={continueDisabled} onClick={() => { /* route to next step */ }}>
          Continue <Check className="w-4 h-4 text-white" />
        </GreenButton>
      </div>

      <style jsx global>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes sheen { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
      `}</style>

      {/* Modal */}
      {open && (
        <div className="fixed inset-y-0 right-0 left-[260px] z-40 flex items-center justify-center px-4 md:px-8">
          <div className="absolute inset-0 bg-black/60" onClick={() => !submitting && setOpen(false)} />
          <div className="relative w-full max-w-[1100px] max-h-[88vh] flex flex-col" style={FRAME}>
            <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
              <div className="min-w-0">
                <h2 className="text-white text-lg font-semibold truncate">Add Phone Number</h2>
                <div className="text-white/80 text-xs">Import from Twilio/Telnyx or verify your own number via SMS.</div>
              </div>
              <button onClick={() => !submitting && setOpen(false)} className="p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              {banner && (
                <div className="mb-4 rounded-[14px] px-4 py-3 text-sm"
                     style={{ ...CARD, border: '1px solid rgba(255,193,7,0.35)', background: 'rgba(255,193,7,0.10)' }}>
                  <span className="text-amber-200">{banner}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
                {/* rail */}
                <div className="p-3" style={{ ...CARD, border: '1px solid rgba(255,255,255,0.18)' }}>
                  <div className="text-[12px] uppercase tracking-wide text-white/65 mb-2 px-1">Phone Number Options</div>
                  <RailTab label="Import Twilio"  active={pane==='importTwilio'} onClick={()=>setPane('importTwilio')} />
                  <RailTab label="Import Telnyx"  active={pane==='importTelnyx'} onClick={()=>setPane('importTelnyx')} />
                  <RailTab label="Use My Number (SMS)" active={pane==='useOwn'} onClick={()=>setPane('useOwn')} />
                </div>

                {/* pane */}
                <div className="p-5" style={{ ...CARD, boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }}>
                  {pane === 'importTwilio' && (
                    <div className="max-w-xl">
                      <Field label="Twilio Phone Number" error={fieldErrors.phone}>
                        <input value={twPhone} onChange={(e)=>{ setTwPhone(e.target.value); setFieldErrors(s=>({ ...s, phone:'' })); }}
                               placeholder="+15555551234" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                      </Field>
                      <Field label="Twilio Account SID" error={fieldErrors.accountSid}>
                        <input value={twSid} onChange={(e)=>{ setTwSid(e.target.value); setFieldErrors(s=>({ ...s, accountSid:'' })); }}
                               placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                      </Field>
                      <Field label="Twilio Auth Token" error={fieldErrors.authToken}>
                        <input type="password" value={twToken} onChange={(e)=>{ setTwToken(e.target.value); setFieldErrors(s=>({ ...s, authToken:'' })); }}
                               placeholder="••••••••••••••••" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                      </Field>
                      <Field label="Label (optional)">
                        <input value={twLabel} onChange={(e)=>setTwLabel(e.target.value)} placeholder="Sales line"
                               className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                      </Field>
                      <div className="mt-6 flex justify-end gap-3">
                        <GhostButton onClick={()=>setOpen(false)}>Cancel</GhostButton>
                        <GreenButton onClick={onSubmit}>Import from Twilio</GreenButton>
                      </div>
                    </div>
                  )}

                  {pane === 'importTelnyx' && (
                    <div className="max-w-xl">
                      <Field label="Telnyx Phone Number" error={fieldErrors.txPhone}>
                        <input value={txPhone} onChange={(e)=>{ setTxPhone(e.target.value); setFieldErrors(s=>({ ...s, txPhone:'' })); }}
                               placeholder="+15555550123" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                      </Field>
                      <Field label="Telnyx API Key" error={fieldErrors.txKey}>
                        <input value={txKey} onChange={(e)=>{ setTxKey(e.target.value); setFieldErrors(s=>({ ...s, txKey:'' })); }}
                               placeholder="TELNYX_SECRET_xxx" className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                      </Field>
                      <Field label="Label (optional)">
                        <input value={txLabel} onChange={(e)=>setTxLabel(e.target.value)} placeholder="Main line"
                               className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                      </Field>
                      <div className="mt-6 flex justify-end gap-3">
                        <GhostButton onClick={()=>setOpen(false)}>Cancel</GhostButton>
                        <GreenButton onClick={onSubmit}>Import from Telnyx</GreenButton>
                      </div>
                    </div>
                  )}

                  {pane === 'useOwn' && (
                    <div className="max-w-xl">
                      <div className="flex items-center gap-2 text-white/85 mb-2 text-sm">
                        <MessageSquare className="w-4 h-4 text-[#6af7d1]" /> Verify ownership by SMS
                      </div>

                      {!otpSent && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
                            <CountryDialSelect
                              value={ownIso2}
                              onChange={(iso2, dial) => { setOwnIso2(iso2); setOwnDial(dial); }}
                              label="Country"
                              id="own-country"
                            />
                            <div>
                              <label className="mb-1 block text-xs text-white/70">Your Phone Number</label>
                              <input
                                value={ownPhone}
                                onChange={(e) => { setOwnPhone(e.target.value); setFieldErrors(s => ({ ...s, ownPhone: '' })); }}
                                placeholder="e.g. 700123456  (or paste +15555550123)"
                                className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]"
                              />
                              {fieldErrors.ownPhone ? (
                                <div className="mt-1 text-xs text-red-300">{fieldErrors.ownPhone}</div>
                              ) : (
                                <div className="mt-1 text-xs text-white/60">
                                  Enter a national number; we’ll prefix <code>+{ownDial}</code>, or paste a full <code>E.164</code>.
                                </div>
                              )}
                            </div>
                          </div>

                          <Field label="Label (optional)">
                            <input value={ownLabel} onChange={(e)=>setOwnLabel(e.target.value)} placeholder="My personal number"
                                   className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[#6af7d1]" />
                          </Field>

                          <div className="mt-6 flex justify-end gap-3">
                            <GhostButton onClick={()=>setOpen(false)}>Cancel</GhostButton>
                            <GreenButton onClick={sendOtp}>Send Code</GreenButton>
                          </div>
                          <p className="mt-3 text-xs text-white/60">
                            Works worldwide. In dev/mock mode the code is <code>000000</code>.
                          </p>
                        </>
                      )}

                      {otpSent && (
                        <>
                          {/* Timer & controls */}
                          <div className="mb-3 rounded-[12px] px-3 py-2 text-sm flex items-center justify-between"
                               style={{ ...CARD, border: '1px solid rgba(255,255,255,0.16)' }}>
                            <div className="text-white/80">
                              {isExpired ? (
                                <span className="text-amber-300">Code expired. Please resend a new one.</span>
                              ) : (
                                <>Code sent. Expires in <b>{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</b>.</>
                              )}
                            </div>
                            <button
                              onClick={sendOtp}
                              disabled={resendIn > 0}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[16px] text-sm font-medium transition-colors disabled:opacity-60"
                              style={{
                                background: resendIn>0 ? BTN_DISABLED : BTN_GREEN,
                                color: '#ffffff',
                              }}
                            >
                              <RotateCw className="w-4 h-4" />
                              {resendIn>0 ? `Resend in ${resendIn}s` : 'Resend Code'}
                            </button>
                          </div>

                          <Field label="Enter 6-digit Code" error={fieldErrors.otp}>
                            <input
                              value={otpCode}
                              onChange={(e)=>{ setOtpCode(e.target.value.replace(/[^\d]/g,'')); setFieldErrors(s=>({ ...s, otp:'' })); }}
                              placeholder="123456"
                              maxLength={6}
                              disabled={isExpired}
                              className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-2 text-sm tracking-widest text-center outline-none focus:border-[#6af7d1] disabled:opacity-60"
                            />
                          </Field>
                          <div className="mt-6 flex justify-end gap-3">
                            <GhostButton onClick={()=>{ setOtpSent(false); setOtpCode(''); setOtpMeta(null); }}>Back</GhostButton>
                            <GreenButton onClick={verifyOtp} disabled={otpCode.length !== 6 || isExpired}>Verify & Import</GreenButton>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', background: '#101314' }}>
              <div className="flex justify-end">
                <GreenButton onClick={() => !submitting && setOpen(false)}>Close</GreenButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* Buttons */
function GreenButton({ children, onClick, disabled, title }:{
  children: React.ReactNode; onClick?: ()=>void; disabled?: boolean; title?: string;
}) {
  const isDisabled = !!disabled;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors disabled:cursor-not-allowed"
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
function GhostButton({ children, onClick }:{ children: React.ReactNode; onClick?: ()=>void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold transition-colors"
      style={{ border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.25)', color: 'white' }}
    >
      {children}
    </button>
  );
}
function RailTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full mb-2 text-left text-sm rounded-[12px] px-3 py-2 transition"
      style={{
        border: active ? '1px solid rgba(0,255,194,0.4)' : '1px solid rgba(255,255,255,0.18)',
        background: active ? '#0f1316' : '#0d1012',
        color: active ? 'white' : 'rgba(255,255,255,0.85)',
      }}>
      {label}
    </button>
  );
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-xs text-white/70">{label}</div>
      {children}
      {error && <div className="mt-1 text-xs text-red-300">{error}</div>}
    </div>
  );
}
s
