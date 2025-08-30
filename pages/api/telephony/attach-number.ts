// pages/api/telephony/attach-number.ts
// Accept BOTH payload shapes:
//  A) { accountSid, authToken, phoneNumber, agentId? }
//  B) { phoneNumber, agentId?, credentials:{ accountSid, authToken } }
//
// Returns JSON only: { ok:true, data:{ phoneNumber, voiceUrl } } or { ok:false, error }

import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };
type Result = Ok<{ phoneNumber: string; voiceUrl: string }>;

const E164 = /^\+[1-9]\d{1,14}$/;

function sanitizeSid(s: string) {
  return (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
function isValidSid(s: string) {
  const t = sanitizeSid(s);
  return /^AC[A-Za-z0-9]{32}$/.test(t);
}
async function safeText(r: Response) {
  try { return await r.text(); } catch { return `${r.status} ${r.statusText}`; }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Result | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const body = (req.body || {}) as any;

    // Accept flat or nested credentials
    const accountSidRaw: string =
      body.accountSid ?? body.AccountSid ?? body?.credentials?.accountSid ?? body?.credentials?.AccountSid ?? '';
    const authTokenRaw: string =
      body.authToken ?? body.AuthToken ?? body?.credentials?.authToken ?? body?.credentials?.AuthToken ?? '';
    const phoneNumberRaw: string =
      body.phoneNumber ?? body.fromE164 ?? body.fromNumber ?? '';

    const agentId: string | undefined = body.agentId;

    const accountSid = sanitizeSid(accountSidRaw);
    const authToken = (authTokenRaw || '').trim();
    const phoneNumber = (phoneNumberRaw || '').trim();

    // ---- validation ----
    if (!isValidSid(accountSid)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing Twilio Account SID.' });
    }
    if (!authToken) {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token.' });
    }
    if (!phoneNumber || !E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    // ---- public base URL (Vercel/Proxy safe) ----
    const proto =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.headers['x-forwarded-protocol'] as string) ||
      'https';
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers['host'] as string) ||
      '';
    if (!host) {
      return res.status(500).json({ ok: false, error: 'Could not detect public host from request headers.' });
    }
    const baseUrl = `${proto}://${host}`.replace(/\/+$/, '');
    const voiceUrl = `${baseUrl}/api/voice/twilio/incoming${agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''}`;

    // ---- Twilio REST via fetch (no SDK required) ----
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // 1) Lookup the number to get its IncomingPhoneNumber SID
    const listUrl = `${apiBase}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const listResp = await fetch(listUrl, {
      method: 'GET',
      headers: { Authorization: authHeader },
    });

    if (!listResp.ok) {
      const txt = await safeText(listResp);
      return res.status(listResp.status).json({ ok: false, error: `Twilio lookup failed: ${txt}` });
    }

    const listJson: any = await listResp.json();
    const match = Array.isArray(listJson?.incoming_phone_numbers) ? listJson.incoming_phone_numbers[0] : null;

    if (!match?.sid) {
      return res.status(404).json({ ok: false, error: `Twilio number not found in this account: ${phoneNumber}` });
    }
    const pnSid: string = match.sid;

    // 2) Update VoiceUrl
    const updateUrl = `${apiBase}/IncomingPhoneNumbers/${pnSid}.json`;
    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');

    const updResp = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: form.toString(),
    });

    if (!updResp.ok) {
      const txt = await safeText(updResp);
      return res.status(updResp.status).json({ ok: false, error: `Twilio update failed: ${txt}` });
    }

    return res.status(200).json({ ok: true, data: { phoneNumber, voiceUrl } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unexpected server error.' });
  }
}
