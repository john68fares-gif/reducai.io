// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };
type Result = Ok<{ phoneNumber: string; voiceUrl: string }>;

const E164 = /^\+[1-9]\d{1,14}$/;
const SID  = /^AC[a-zA-Z0-9]{32}$/;

export default async function attachNumberHandler(
  req: NextApiRequest,
  res: NextApiResponse<Result | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const body = (req.body || {}) as any;

    // allow either {credentials:{...}} or flat props
    const accountSid = (body.credentials?.accountSid || body.accountSid || '').toString().trim();
    const authToken  = (body.credentials?.authToken  || body.authToken  || '').toString().trim();
    const phoneNumber = (body.phoneNumber || '').toString().trim();
    const agentId     = (body.agentId || '').toString().trim();

    // voice & behavior config (all optional)
    const language  = (body.language || '').toString().trim();             // e.g., "en-US"
    const voice     = (body.voice || '').toString().trim();                // e.g., "Polly.Joanna" or "alice"
    const greeting  = (body.greeting || '').toString();
    const style     = (body.style || '').toString();                       // conversational | professional | newscaster | ''
    const delayMs   = Number(body.delayMs ?? 0);
    const rate      = Number(body.rate ?? 100);
    const pitch     = Number(body.pitch ?? 0);
    const bargeIn   = !!body.bargeIn;

    // ---- validate basics ----
    if (!SID.test(accountSid)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing Twilio Account SID.' });
    }
    if (!authToken) {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token.' });
    }
    if (!E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    // ---- figure out our public base URL ----
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

    // Build webhook with all query params
    const qs = new URLSearchParams();
    if (agentId) qs.set('agentId', agentId);
    if (language) qs.set('lang', language);
    if (voice) qs.set('voice', voice);
    if (greeting) qs.set('greeting', greeting);
    if (style) qs.set('style', style);                  // conversational | professional | newscaster | ''
    if (Number.isFinite(delayMs)) qs.set('delayMs', String(Math.max(0, Math.min(5000, delayMs))));
    if (Number.isFinite(rate))    qs.set('rate',    String(Math.max(60, Math.min(140, rate))));
    if (Number.isFinite(pitch))   qs.set('pitch',   String(Math.max(-6, Math.min(6, pitch))));
    qs.set('bargeIn', bargeIn ? '1' : '0');

    const voiceUrl = `${baseUrl}/api/voice/twilio/incoming?${qs.toString()}`;

    // ---- Twilio REST: link the number to our webhook ----
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // 1) Find IncomingPhoneNumber SID
    const listUrl = `${apiBase}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const listResp = await fetch(listUrl, { method: 'GET', headers: { Authorization: authHeader }});
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

async function safeText(r: Response) {
  try { return await r.text(); } catch { return `${r.status} ${r.statusText}`; }
}
