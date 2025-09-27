// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string; details?: any };
type Result = Ok<{ sid: string; phoneNumber: string; voiceUrl: string; voiceFallbackUrl: string | null }>;

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

    // ---- Creds (per-user in body, else env) ----
    const accountSid = (b.accountSid || b?.credentials?.accountSid || process.env.TWILIO_ACCOUNT_SID || '')
      .toString().trim();
    const authToken  = (b.authToken  || b?.credentials?.authToken  || process.env.TWILIO_AUTH_TOKEN  || '')
      .toString().trim();

    const phoneNumber = (b.phoneNumber || '').toString().trim();
    const agentId     = (b.agentId || '').toString().trim();

    if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing Twilio Account SID.' });
    }
    if (!authToken) {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token.' });
    }
    if (!E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    // ---- Optional voice config passed from UI ----
    const cfg = {
      language: (b.language || '').toString().trim(),  // -> ?lang=
      voice:    (b.voice    || '').toString().trim(),  // -> ?voice=
      greeting: (b.greeting || '').toString().trim(),  // -> ?greet=
      style:    (b.style    || '').toString().trim(),  // -> ?style=
      delayMs:  clampNum(b.delayMs, 0, 5000, 0),       // -> ?delay=
      rate:     clampNum(b.rate,    60, 140, 100),     // -> ?rate=
      pitch:    clampNum(b.pitch,   -6, 6,   0),       // -> ?pitch=
      bargeIn:  !!b.bargeIn,                           // -> ?barge=
      mode:     ((b.mode || '').toString().trim().toLowerCase() === 'assistant') ? 'assistant' : 'user', // -> ?mode=
    };

    // ---- Public base URL (must be https + public) ----
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
    if (!/^https:\/\//i.test(baseUrl)) {
      return res.status(400).json({ ok: false, error: 'PUBLIC_BASE_URL must be HTTPS and publicly reachable by Twilio.' });
    }

    // ---- Build VoiceUrl (& Fallback) with query for your runtime ----
    const voiceUrlObj = new URL(`${baseUrl}/api/voice/twilio/incoming`);
    if (cfg.language) voiceUrlObj.searchParams.set('lang', cfg.language);
    if (cfg.voice)    voiceUrlObj.searchParams.set('voice', cfg.voice);
    if (cfg.greeting) voiceUrlObj.searchParams.set('greet', cfg.greeting);
    if (cfg.style)    voiceUrlObj.searchParams.set('style', cfg.style);
    if (agentId)      voiceUrlObj.searchParams.set('agent', agentId);
    voiceUrlObj.searchParams.set('mode', cfg.mode); // NEW
    voiceUrlObj.searchParams.set('delay', String(cfg.delayMs));
    voiceUrlObj.searchParams.set('rate',  String(cfg.rate));
    voiceUrlObj.searchParams.set('pitch', String(cfg.pitch));
    voiceUrlObj.searchParams.set('barge', cfg.bargeIn ? '1' : '0');

    const voiceUrl = voiceUrlObj.toString();

    // Fallback URL
    const voiceFallbackUrlObj = new URL(voiceUrl);
    voiceFallbackUrlObj.searchParams.set('fallback', '1');
    const voiceFallbackUrl = voiceFallbackUrlObj.toString();

    // ---- Twilio REST calls ----
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

    // 2) Update routing
    const updateUrl = `${apiBase}/IncomingPhoneNumbers/${pnSid}.json`;
    const form = new URLSearchParams();
    form.set('VoiceApplicationSid', '');
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');
    form.set('VoiceFallbackUrl', voiceFallbackUrl);
    form.set('VoiceFallbackMethod', 'POST');

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

    // 3) Verify
    const getResp = await fetch(`${apiBase}/IncomingPhoneNumbers/${pnSid}.json`, {
      method: 'GET',
      headers: { Authorization: authHeader },
    });
    const getJson: any = await getResp.json();

    return res.status(200).json({
      ok: true,
      data: {
        sid: pnSid,
        phoneNumber,
        voiceUrl: getJson?.voice_url || voiceUrl,
        voiceFallbackUrl: getJson?.voice_fallback_url || voiceFallbackUrl,
      },
    });
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
