// pages/api/telephony/attach-number.ts
// Sets Twilio VoiceUrl to our Incoming handler with voice config in the query string.
// Accepts either flat credentials or { credentials:{ accountSid, authToken } }.

import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };
type Result = Ok<{ phoneNumber: string; voiceUrl: string }>;

const E164 = /^\+[1-9]\d{1,14}$/;
const isSid = (s?: string) => !!s && /^AC[a-zA-Z0-9]{32}$/.test(s);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Result | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const b = (req.body || {}) as any;

    const accountSid = b.accountSid || b?.credentials?.accountSid;
    const authToken  = b.authToken  || b?.credentials?.authToken;
    const phoneNumber = b.phoneNumber as string;

    // Optional voice config:
    const lang    = (b.language || 'en-US').toString();
    const voice   = (b.voice || 'Polly.Joanna').toString();
    const style   = (b.style || '').toString(); // not used by TwiML (kept for future)
    const greeting = (b.greeting || 'Thank you for calling. How can I help today?').toString();
    const delayMs = Number(b.delayMs ?? 300);
    const rate    = Number(b.rate ?? 100);
    const pitch   = Number(b.pitch ?? 0);
    // bargeIn intentionally not sent (Twilio XML attr can be finicky)

    if (!isSid(accountSid)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing Twilio Account SID.' });
    }
    if (!authToken || typeof authToken !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token.' });
    }
    if (!phoneNumber || !E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    // figure out public base URL
    const proto =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.headers['x-forwarded-protocol'] as string) ||
      'https';
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers['host'] as string) || '';
    if (!host) return res.status(500).json({ ok:false, error:'Could not detect public host.' });

    const baseUrl = `${proto}://${host}`.replace(/\/+$/,'');
    const qs = new URLSearchParams({
      lang, voice,
      greeting,
      delayMs: String(Math.max(0, Math.min(5000, delayMs))),
      rate:    String(Math.max(60, Math.min(140, rate))),
      pitch:   String(Math.max(-6, Math.min(6, pitch))),
      style
    }).toString();

    const voiceUrl = `${baseUrl}/api/voice/twilio/incoming?${qs}`;

    // Twilio REST calls
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // 1) lookup number SID
    const listUrl = `${apiBase}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const listResp = await fetch(listUrl, { method:'GET', headers:{ Authorization: authHeader }});
    if (!listResp.ok) {
      const txt = await safeText(listResp);
      return res.status(listResp.status).json({ ok:false, error:`Twilio lookup failed: ${txt}` });
    }
    const listJson: any = await listResp.json();
    const match = Array.isArray(listJson?.incoming_phone_numbers) ? listJson.incoming_phone_numbers[0] : null;
    if (!match?.sid) {
      return res.status(404).json({ ok:false, error:`Twilio number not found in this account: ${phoneNumber}` });
    }

    // 2) update VoiceUrl
    const updateUrl = `${apiBase}/IncomingPhoneNumbers/${match.sid}.json`;
    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');

    const updResp = await fetch(updateUrl, {
      method:'POST',
      headers:{ Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString(),
    });
    if (!updResp.ok) {
      const txt = await safeText(updResp);
      return res.status(updResp.status).json({ ok:false, error:`Twilio update failed: ${txt}` });
    }

    return res.status(200).json({ ok:true, data:{ phoneNumber, voiceUrl } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error: e?.message || 'Unexpected server error.' });
  }
}

async function safeText(r: Response) {
  try { return await r.text(); } catch { return `${(r as any).status} ${(r as any).statusText}`; }
}
