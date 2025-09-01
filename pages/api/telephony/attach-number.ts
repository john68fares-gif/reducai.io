import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };
type Result = Ok<{ phoneNumber: string; voiceUrl: string }>;

const E164 = /^\+[1-9]\d{1,14}$/;

export default async function attachNumberHandler(
  req: NextApiRequest,
  res: NextApiResponse<Result | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const b = (req.body || {}) as any;

    // Accept either inline creds OR fall back to platform env vars
    const bodySid   = (b.accountSid || b?.credentials?.accountSid || '').toString().trim();
    const bodyToken = (b.authToken  || b?.credentials?.authToken  || '').toString().trim();
    const envSid    = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const envToken  = (process.env.TWILIO_AUTH_TOKEN  || '').trim();

    const accountSid = /^AC[a-zA-Z0-9]{32}$/.test(bodySid) ? bodySid : envSid;
    const authToken  = bodyToken || envToken;

    if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Account SID (body or env).' });
    }
    if (!authToken) {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token (body or env).' });
    }

    const phoneNumber = (b.phoneNumber || '').toString().trim();
    if (!E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    // Optional config
    const cfg = {
      language: (b.language || '').toString().trim(),
      voice: (b.voice || '').toString().trim(),
      greeting: (b.greeting || '').toString().trim(),
      style: (b.style || '').toString().trim(),
      delayMs: Number(b.delayMs || 0),
      rate: Number(b.rate || 100),
      pitch: Number(b.pitch || 0),
      bargeIn: !!b.bargeIn,
      agentId: (b.agentId || '').toString().trim(),
    };

    // Build public base URL
    const proto =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.headers['x-forwarded-protocol'] as string) ||
      'https';
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers['host'] as string) || '';
    if (!host) {
      return res.status(500).json({ ok: false, error: 'Could not detect public host from request headers.' });
    }
    const baseUrl = `${proto}://${host}`.replace(/\/+$/, '');

    const url = new URL(`${baseUrl}/api/voice/twilio/incoming`);
    if (cfg.agentId) url.searchParams.set('agent', cfg.agentId);
    if (cfg.language) url.searchParams.set('lang', cfg.language);
    if (cfg.voice) url.searchParams.set('voice', cfg.voice);
    if (cfg.greeting) url.searchParams.set('greet', cfg.greeting);
    if (cfg.style) url.searchParams.set('style', cfg.style);
    url.searchParams.set('delay', String(Math.max(0, Math.min(5000, cfg.delayMs))));
    url.searchParams.set('rate',  String(Math.max(60, Math.min(140, cfg.rate))));
    url.searchParams.set('pitch', String(Math.max(-6, Math.min(6, cfg.pitch))));
    url.searchParams.set('barge', cfg.bargeIn ? '1' : '0');
    const voiceUrl = url.toString();

    // Twilio REST
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // 1) Lookup number → SID
    const listUrl = `${apiBase}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const listResp = await fetch(listUrl, { method: 'GET', headers: { Authorization: authHeader } });
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

async function safeText(r: Response) {
  try { return await r.text(); } catch { return `${r.status} ${r.statusText}`; }
}
