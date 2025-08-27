// pages/api/telephony/phone-numbers.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Provider = 'twilio' | 'telnyx' | 'own';
type Status = 'active' | 'activating' | 'failed' | 'verified' | string;
type PhoneNumber = { id: string; e164?: string; label?: string; provider: Provider; status?: Status };

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: { code: string; message: string; hint?: string; details?: any } };
type Env<T> = Ok<T> | Err;

const mem = global as any;
mem.__numbers ??= [] as PhoneNumber[];
mem.__otp ??= new Map<string, { code: string; expiresAt: number }>();

const HAS_TWILIO_ENVS =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.BASE_URL;

function json<T>(res: NextApiResponse<Env<T>>, body: Env<T>, code = 200) {
  res.setHeader('Content-Type', 'application/json');
  res.status(body.ok ? code : 400).json(body);
}
function isE164(s: string) { return /^\+[1-9]\d{1,14}$/.test(s); }
function uid(prefix = 'num_') { return prefix + Math.random().toString(36).slice(2, 10); }

// ---------- tiny Twilio helpers (lazy load to avoid bundling in mock) ----------
async function twilioClient() {
  // install if missing:  npm i twilio
  const tw = await import('twilio');
  return tw.default(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

async function twilioListNumbers() {
  const client = await twilioClient();
  const nums = await client.incomingPhoneNumbers.list({ limit: 50 });
  return nums.map(n => ({
    id: n.sid,
    e164: n.phoneNumber,
    label: n.friendlyName || n.phoneNumber,
    provider: 'twilio' as const,
    status: n.voiceCallerIdLookup ? 'active' : 'active',
  }));
}

async function twilioAttachWebhooks(phoneSid: string) {
  const client = await twilioClient();
  const base = process.env.BASE_URL!.replace(/\/+$/,'');
  const voiceUrl = `${base}/api/twilio/voice`;
  const statusUrl = `${base}/api/twilio/recording-complete`;

  await client.incomingPhoneNumbers(phoneSid).update({
    voiceUrl,
    voiceMethod: 'POST',
    statusCallback: statusUrl,
    statusCallbackMethod: 'POST',
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      // Real Twilio if envs set, otherwise show in-memory dev numbers
      if (HAS_TWILIO_ENVS) {
        try {
          const list = await twilioListNumbers();
          return json(res, { ok: true, data: list });
        } catch (e: any) {
          // fall back to memory so UI still works
          return json(res, {
            ok: false,
            error: { code: 'TWILIO_LIST_FAILED', message: e?.message || 'Twilio list failed' }
          });
        }
      }
      return json(res, { ok: true, data: mem.__numbers });
    }

    if (req.method === 'POST') {
      const { action, payload } = req.body || {};

      // === Import Twilio number ===
      if (action === 'importTwilio') {
        const { phone, accountSid, authToken, label, phoneSid } = payload || {};
        if (!isE164(phone)) {
          return json(res, { ok: false, error: { code: 'BAD_PHONE', message: 'Use E.164 (+15551234567)', details: { field: 'phone' } } });
        }
        // in prod we ignore accountSid/authToken from client; we use server envs
        if (HAS_TWILIO_ENVS && phoneSid) {
          try {
            await twilioAttachWebhooks(phoneSid);
            const number: PhoneNumber = { id: phoneSid, e164: phone, label, provider: 'twilio', status: 'active' };
            return json(res, { ok: true, data: { number } });
          } catch (e: any) {
            return json(res, { ok: false, error: { code: 'TWILIO_ATTACH_FAIL', message: e?.message || 'Failed to attach webhooks' } });
          }
        } else {
          // dev/mock: accept anything, store locally
          const number: PhoneNumber = { id: uid('tw_'), e164: phone, label, provider: 'twilio', status: 'active' };
          mem.__numbers.unshift(number);
          return json(res, { ok: true, data: { number } });
        }
      }

      // === Import Telnyx (mock only for now) ===
      if (action === 'importTelnyx') {
        const { phone, label } = payload || {};
        if (!isE164(phone)) {
          return json(res, { ok: false, error: { code: 'BAD_PHONE', message: 'Use E.164', details: { field: 'txPhone' } } });
        }
        const number: PhoneNumber = { id: uid('tx_'), e164: phone, label, provider: 'telnyx', status: 'active' };
        mem.__numbers.unshift(number);
        return json(res, { ok: true, data: { number } });
      }

      // === Bring-your-own number: start & check SMS verify (DEV MOCK) ===
      if (action === 'startSmsVerify') {
        const { phone } = payload || {};
        if (!isE164(phone)) return json(res, { ok: false, error: { code: 'BAD_PHONE', message: 'Invalid phone', details: { field: 'ownPhone' } } });
        const code = process.env.VERIFY_DEV_CODE || '000000';
        const ttl = Number(process.env.VERIFY_TTL_SEC || 300);
        mem.__otp.set(phone, { code, expiresAt: Date.now() + ttl * 1000 });
        return json(res, { ok: true, data: { sent: true, mode: 'mock', expiresInSec: ttl, resendInSec: 30 } });
      }

      if (action === 'checkSmsVerify') {
        const { phone, code, label } = payload || {};
        const row = mem.__otp.get(phone);
        if (!row) return json(res, { ok: false, error: { code: 'NO_CODE', message: 'No code pending' } });
        if (Date.now() > row.expiresAt) return json(res, { ok: false, error: { code: 'EXPIRED', message: 'Code expired' } });
        if ((code || '').trim() !== row.code) return json(res, { ok: false, error: { code: 'BAD_CODE', message: 'Incorrect code' } });
        mem.__otp.delete(phone);
        const number: PhoneNumber = { id: uid('own_'), e164: phone, label, provider: 'own', status: 'verified' };
        mem.__numbers.unshift(number);
        return json(res, { ok: true, data: { number } });
      }

      return json(res, { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unsupported action: ${action}` } });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end('Method Not Allowed');
  } catch (e: any) {
    return json(res, { ok: false, error: { code: 'SERVER_ERROR', message: e?.message || 'Server error' } });
  }
}
