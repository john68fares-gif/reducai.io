// pages/api/telephony/attach-number.ts
// Accept BOTH shapes and pass voice config to the voice URL as query params.

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

export default async function handler(req: NextApiRequest, res: NextApiResponse<Result | Err>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const body = (req.body || {}) as any;

    // Accept both payload shapes
    const accountSidRaw: string =
      body.accountSid ?? body.AccountSid ?? body?.credentials?.accountSid ?? body?.credentials?.AccountSid ?? '';
    const authTokenRaw: string =
      body.authToken ?? body.AuthToken ?? body?.credentials?.authToken ?? body?.credentials?.AuthToken ?? '';
    const phoneNumberRaw: string =
      body.phoneNumber ?? body.fromE164 ?? body.fromNumber ?? '';

    // Optional config from client
    const cfg = {
      voice: String(body.voice || body.ttsVoice || 'Polly.Joanna'),
      lang: String(body.language || body.lang || 'en-US'),
      style: String(body.style || ''),                 // 'conversational' | 'professional' | 'newscaster'
      greet: String(body.greeting || body.greet || ''),// first sentence
      delayMs: String(body.delayMs ?? ''),             // e.g., 300
      rate: String(body.rate ?? body.ratePct ?? ''),   // 60..140
      pitch: String(body.pitch ?? body.pitchSemitones ?? ''), // -6..+6
      bargeIn: String(body.bargeIn ? '1' : ''),
      agentId: String(body.agentId || ''),             // optional, if you want to carry it
    };

    const accountSid = sanitizeSid(accountSidRaw);
    const authToken = (authTokenRaw || '').trim();
    const phoneNumber = (phoneNumberRaw || '').trim();

    if (!isValidSid(accountSid)) return res.status(400).json({ ok: false, error: 'Invalid or missing Twilio Account SID.' });
    if (!authToken)              return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token.' });
    if (!phoneNumber || !E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-protocol'] as string) || 'https';
    const host  = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string) || '';
    if (!host) return res.status(500).json({ ok: false, error: 'Could not detect public host from request headers.' });
    const baseUrl = `${proto}://${host}`.replace(/\/+$/, '');

    // Build voice URL with config as query params
    const url = new URL(baseUrl + '/api/voice/twilio/incoming');
    if (cfg.agentId) url.searchParams.set('agentId', cfg.agentId);
    if (cfg.voice)   url.searchParams.set('voice', cfg.voice);
    if (cfg.lang)    url.searchParams.set('lang', cfg.lang);
    if (cfg.style)   url.searchParams.set('style', cfg.style);
    if (cfg.greet)   url.searchParams.set('greet', cfg.greet);
    if (cfg.delayMs) url.searchParams.set('delayMs', cfg.delayMs);
    if (cfg.rate)    url.searchParams.set('rate', cfg.rate);
    if (cfg.pitch)   url.searchParams.set('pitch', cfg.pitch);
    if (cfg.bargeIn) url.searchParams.set('bargeIn', cfg.bargeIn);

    const voiceUrl = url.toString();

    // Twilio REST via fetch
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // Lookup IncomingPhoneNumber SID
    const listUrl = `${apiBase}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const listResp = await fetch(listUrl, { method: 'GET', headers: { Authorization: authHeader } });
    if (!listResp.ok) {
      const txt = await safeText(listResp);
      return res.status(listResp.status).json({ ok: false, error: `Twilio lookup failed: ${txt}` });
    }
    const listJson: any = await listResp.json();
    const match = Array.isArray(listJson?.incoming_phone_numbers) ? listJson.incoming_phone_numbers[0] : null;
    if (!match?.sid) return res.status(404).json({ ok: false, error: `Twilio number not found in this account: ${phoneNumber}` });

    // Update the VoiceUrl
    const updUrl = `${apiBase}/IncomingPhoneNumbers/${match.sid}.json`;
    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');

    const updResp = await fetch(updUrl, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
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
