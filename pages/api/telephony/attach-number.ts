// pages/api/telephony/attach-number.ts
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

    // ---- Creds: prefer request body (per-user), fall back to env (single-tenant)
    const accountSid = (b.accountSid || b?.credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID || '')
      .toString()
      .trim();
    const authToken  = (b.authToken  || b?.credentials?.authToken  || process.env.TWILIO_AUTH_TOKEN  || '')
      .toString()
      .trim();

    const phoneNumber = (b.phoneNumber || '').toString().trim();
    const agentId     = (b.agentId || '').toString().trim(); // optional, echoed in webhook URL

    if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing Twilio Account SID.' });
    }
    if (!authToken) {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token.' });
    }
    if (!E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    // Optional config passed from UI
    const cfg = {
      language: (b.language || '').toString().trim(),
      voice: (b.voice || '').toString().trim(),
      greeting: (b.greeting || '').toString().trim(),
      style: (b.style || '').toString().trim(),
      delayMs: clampNum(b.delayMs, 0, 5000, 0),
      rate:    clampNum(b.rate,    60, 140, 100),
      pitch:   clampNum(b.pitch,   -6, 6,   0),
      bargeIn: !!b.bargeIn,
    };

    // ---- Public base URL: env override or detect from headers
    const detectedProto =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.headers['x-forwarded-protocol'] as string) ||
      'https';
    const detectedHost =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers['host'] as string) ||
      '';

    const envBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const detectedBase = detectedHost ? `${detectedProto}://${detectedHost}`.replace(/\/+$/, '') : '';

    const baseUrl = envBase || detectedBase;
    if (!baseUrl) {
      return res.status(500).json({ ok: false, error: 'Could not determine public base URL (set PUBLIC_BASE_URL or ensure Host headers are present).' });
    }

    // ---- Build webhook (VoiceUrl) with query for your runtime to read
    const url = new URL(`${baseUrl}/api/voice/twilio/incoming`);
    if (cfg.language) url.searchParams.set('lang', cfg.language);
    if (cfg.voice)    url.searchParams.set('voice', cfg.voice);
    if (cfg.greeting) url.searchParams.set('greet', cfg.greeting);
    if (cfg.style)    url.searchParams.set('style', cfg.style);
    if (agentId)      url.searchParams.set('agent', agentId);
    url.searchParams.set('delay', String(cfg.delayMs));
    url.searchParams.set('rate',  String(cfg.rate));
    url.searchParams.set('pitch', String(cfg.pitch));
    url.searchParams.set('barge', cfg.bargeIn ? '1' : '0');

    const voiceUrl = url.toString();

    // ---- Twilio REST calls
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

/* ------------------------ helpers ------------------------ */
function clampNum(v: any, min: number, max: number, dflt: number) {
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(min, Math.min(max, n));
  return dflt;
}
async function safeText(r: Response) {
  try { return await r.text(); } catch { return `${r.status} ${r.statusText}`; }
}
