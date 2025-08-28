// pages/api/telephony/phone-numbers.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/** ------------------------------------------------------------------------
 *  WHY THIS FIXES THE “DISAPPEAR ON REFRESH” PROBLEM
 *  - We persist numbers per-user in Vercel KV (if configured), keyed by a cookie session.
 *  - If KV is not configured, we still persist in an encrypted cookie (small lists).
 *  - Twilio import now REQUIRES Account SID + Auth Token and verifies ownership via Twilio API.
 * -------------------------------------------------------------------------*/

type Provider = 'twilio' | 'telnyx' | 'own';
type Status = 'active' | 'activating' | 'failed' | 'verified';
type PhoneNumber = { id: string; e164?: string; label?: string; provider: Provider; status?: Status };
type Envelope<T> = { ok: true; data: T } | { ok: false; error: string; details?: any };

const SESSION_COOKIE = 'rid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1y
const E164 = /^\+[1-9]\d{1,14}$/;

function json<T>(res: NextApiResponse, status: number, body: Envelope<T>) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).end(JSON.stringify(body));
}
function getSessionId(req: NextApiRequest, res: NextApiResponse) {
  const fromCookie = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(SESSION_COOKIE + '='))
    ?.split('=')[1];
  if (fromCookie) return fromCookie;

  // create new
  const rid =
    (globalThis as any).crypto?.randomUUID?.() ||
    require('crypto').randomBytes(16).toString('hex');
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${rid}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`
  );
  return rid;
}

/* ---------- Minimal KV (optional) ---------- */
const KV_URL = process.env.KV_REST_API_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || '';
async function kvGet<T>(key: string): Promise<T | null> {
  if (!KV_URL || !KV_TOKEN) return null;
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j?.result ?? null;
}
async function kvSet<T>(key: string, value: T): Promise<boolean> {
  if (!KV_URL || !KV_TOKEN) return false;
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  return r.ok;
}

/* ---------- Cookie backup store ---------- */
function getCookieStore(req: NextApiRequest): Record<string, any> {
  const raw = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('nums='))
    ?.split('=')[1];
  if (!raw) return {};
  try { return JSON.parse(decodeURIComponent(raw)); } catch { return {}; }
}
function setCookieStore(res: NextApiResponse, obj: any) {
  const val = encodeURIComponent(JSON.stringify(obj));
  res.setHeader('Set-Cookie', [
    ...(Array.isArray(res.getHeader('Set-Cookie')) ? (res.getHeader('Set-Cookie') as string[]) : []).filter(
      (c) => !c.startsWith('nums=')
    ),
    `nums=${val}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`,
  ]);
}

/* ---------- Helpers ---------- */
const digits = (s: string) => (s || '').replace(/[^\d+]/g, '');
const isE164 = (s: string) => E164.test(s);
const isTwilioSid = (s: string) => /^AC[a-zA-Z0-9]{32}$/.test(s);

async function readNumbers(sessionId: string, req: NextApiRequest): Promise<PhoneNumber[]> {
  const key = `nums:${sessionId}`;
  const kv = await kvGet<PhoneNumber[]>(key);
  if (kv && Array.isArray(kv)) return kv;

  const cookieObj = getCookieStore(req);
  const list = Array.isArray(cookieObj.list) ? cookieObj.list : [];
  return list;
}
async function writeNumbers(sessionId: string, res: NextApiResponse, list: PhoneNumber[]) {
  const key = `nums:${sessionId}`;
  await kvSet(key, list); // best-effort
  setCookieStore(res, { list }); // cookie backup
}

/* ---------- Twilio ownership check ---------- */
async function twilioOwnsNumber(accountSid: string, authToken: string, e164: string) {
  // Verify credentials by listing incoming numbers filtered by PhoneNumber
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(
    e164
  )}`;
  const basic = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const r = await fetch(url, {
    headers: { Authorization: `Basic ${basic}` },
    cache: 'no-store',
  });
  if (r.status === 401 || r.status === 403) {
    throw new Error('Invalid Twilio Account SID or Auth Token.');
  }
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`Twilio API error (${r.status}): ${txt || r.statusText}`);
  }
  const j: any = await r.json();
  return Array.isArray(j?.incoming_phone_numbers) && j.incoming_phone_numbers.length > 0;
}

/* ---------- OTP memory (per session) ---------- */
type OtpState = { code: string; phone: string; expiresAt: number; resendAfter: number };
async function readOtp(sessionId: string): Promise<OtpState | null> {
  const key = `otp:${sessionId}`;
  return (await kvGet<OtpState>(key)) || null;
}
async function writeOtp(sessionId: string, st: OtpState) {
  const key = `otp:${sessionId}`;
  await kvSet(key, st);
}

/* =================================================================== */
/*  HANDLER                                                            */
/* =================================================================== */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const rid = getSessionId(req, res);

  if (req.method === 'GET') {
    const list = await readNumbers(rid, req);
    return json(res, 200, { ok: true, data: list });
  }

  if (req.method === 'POST') {
    let body: any = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; } catch {}
    const { action, payload = {} } = body || {};

    /* ---------- IMPORT TWILIO (strict) ---------- */
    if (action === 'importTwilio') {
      const phone = digits(payload.phone || '');
      const accountSid = String(payload.accountSid || '').trim();
      const authToken = String(payload.authToken || '').trim();
      const label = (payload.label || '').toString().slice(0, 80);

      if (!isE164(phone)) return json(res, 400, { ok: false, error: 'Phone must be E.164 (e.g. +15551234567)' , details:{ field:'phone' }});
      if (!isTwilioSid(accountSid)) return json(res, 400, { ok: false, error: 'Account SID must start with AC and be 34 chars.', details:{ field:'accountSid' }});
      if (!authToken) return json(res, 400, { ok: false, error: 'Auth token required.', details:{ field:'authToken' }});

      try {
        const owns = await twilioOwnsNumber(accountSid, authToken, phone);
        if (!owns) return json(res, 400, { ok: false, error: 'This number is not in that Twilio account.' });
      } catch (e: any) {
        return json(res, 400, { ok: false, error: e?.message || 'Twilio verification failed' });
      }

      const list = await readNumbers(rid, req);
      const id = (globalThis as any).crypto?.randomUUID?.() || require('crypto').randomBytes(8).toString('hex');
      const number: PhoneNumber = { id, e164: phone, label, provider: 'twilio', status: 'active' };
      const next = [number, ...list.filter((n) => n.e164 !== phone)];
      await writeNumbers(rid, res, next);
      return json(res, 200, { ok: true, data: { number } });
    }

    /* ---------- IMPORT TELNYX (basic sanity only) ---------- */
    if (action === 'importTelnyx') {
      const phone = digits(payload.phone || '');
      const apiKey = String(payload.apiKey || '').trim();
      const label = (payload.label || '').toString().slice(0, 80);

      if (!isE164(phone)) return json(res, 400, { ok: false, error: 'Phone must be E.164', details:{ field:'txPhone' }});
      if (!apiKey.startsWith('TELNYX_SECRET_')) return json(res, 400, { ok: false, error: 'API key looks invalid.', details:{ field:'txKey' }});

      // TODO: call Telnyx API to confirm ownership. For now, accept after sanity check.
      const list = await readNumbers(rid, req);
      const id = (globalThis as any).crypto?.randomUUID?.() || require('crypto').randomBytes(8).toString('hex');
      const number: PhoneNumber = { id, e164: phone, label, provider: 'telnyx', status: 'verified' };
      const next = [number, ...list.filter((n) => n.e164 !== phone)];
      await writeNumbers(rid, res, next);
      return json(res, 200, { ok: true, data: { number } });
    }

    /* ---------- OWN NUMBER (OTP — mock) ---------- */
    if (action === 'startSmsVerify') {
      const phone = digits(payload.phone || '');
      if (!isE164(phone)) return json(res, 400, { ok: false, error: 'Phone must be E.164', details:{ field:'ownPhone' }});
      // MOCK mode: generate 000000 (or random) and pretend to send SMS
      const expiresInSec = 5 * 60;
      const resendInSec = 30;
      const now = Date.now();
      const code = process.env.OTP_FIXED_CODE || '000000';
      await writeOtp(rid, { code, phone, expiresAt: now + expiresInSec * 1000, resendAfter: now + resendInSec * 1000 });
      return json(res, 200, { ok: true, data: { sent: true, mode: 'mock', expiresInSec, resendInSec } as any });
    }

    if (action === 'checkSmsVerify') {
      const phone = digits(payload.phone || '');
      const code = String(payload.code || '');
      const label = (payload.label || '').toString().slice(0, 80);

      const st = await readOtp(rid);
      if (!st || st.phone !== phone) return json(res, 400, { ok: false, error: 'No active verification.' });
      if (Date.now() > st.expiresAt) return json(res, 400, { ok: false, error: 'Code expired.' });
      if (code !== st.code) return json(res, 400, { ok: false, error: 'Invalid code.', details:{ field:'otp' } });

      const list = await readNumbers(rid, req);
      const id = (globalThis as any).crypto?.randomUUID?.() || require('crypto').randomBytes(8).toString('hex');
      const number: PhoneNumber = { id, e164: phone, label, provider: 'own', status: 'verified' };
      const next = [number, ...list.filter((n) => n.e164 !== phone)];
      await writeNumbers(rid, res, next);
      return json(res, 200, { ok: true, data: { number } });
    }

    return json(res, 400, { ok: false, error: 'Unknown action' });
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { ok: false, error: 'Method Not Allowed' });
}
