// pages/api/telephony/attach-number.ts
// Auto-attach your app’s webhook to a user’s Twilio number — no env needed.
// Users pass their own Account SID/Auth Token, and we set the Voice URL for them.
//
// POST JSON body:
// {
//   "accountSid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
//   "authToken":  "your_twilio_auth_token",
//   "phoneNumber": "+15551234567",          // E.164
//   "agentId": "some-id-from-your-builder"  // optional; echoed on the webhook URL
// }
//
// Response: { ok: true, data: { phoneNumber: "+1...", voiceUrl: "https://.../api/voice/twilio/incoming?agentId=..." } }
// or       : { ok: false, error: "message" }

import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };
type Result = Ok<{ phoneNumber: string; voiceUrl: string }>;

const E164 = /^\+[1-9]\d{1,14}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse<Result | Err>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const { accountSid, authToken, phoneNumber, agentId } = (req.body || {}) as {
      accountSid?: string;
      authToken?: string;
      phoneNumber?: string;
      agentId?: string;
    };

    // ---- basic validation ----
    if (!accountSid || !/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
      return res.status(400).json({ ok: false, error: 'Invalid or missing Twilio Account SID.' });
    }
    if (!authToken || typeof authToken !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing Twilio Auth Token.' });
    }
    if (!phoneNumber || !E164.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: 'Phone number must be E.164 like +15551234567.' });
    }

    // ---- figure out our public base URL from the request (works on Vercel) ----
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

    // ---- Twilio REST: find IncomingPhoneNumber SID by E.164 ----
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // 1) Lookup the number to get its SID (PNxxxxxxxxxxxxxxxxxxxxxxx)
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

    // 2) Update the VoiceUrl (and optional StatusCallback if you want)
    const updateUrl = `${apiBase}/IncomingPhoneNumbers/${pnSid}.json`;
    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');
    // Optional callbacks:
    // form.set('StatusCallback', `${baseUrl}/api/voice/twilio/status`);
    // form.set('StatusCallbackMethod', 'POST');

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

    // success
    return res.status(200).json({ ok: true, data: { phoneNumber, voiceUrl } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Unexpected server error.' });
  }
}

async function safeText(r: Response) {
  try { return await r.text(); } catch { return `${r.status} ${r.statusText}`; }
}
// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string; details?: any };

function json<T>(res: NextApiResponse, status: number, body: Ok<T> | Err) {
  res.status(status).json(body);
}

/**
 * POST /api/telephony/attach-number
 * Body: {
 *   accountSid: string;         // user's Twilio Account SID (AC...)
 *   authToken: string;          // user's Twilio Auth Token
 *   phoneNumber: string;        // E.164, e.g. "+15551234567"
 *   domain: string;             // your deployed domain, e.g. "https://reducai-io-....vercel.app"
 *   key: string;                // user's OpenAI key (for your voice agent flow)
 *   prompt?: string; voice?: string; lang?: string; greeting?: string;
 * }
 *
 * Effect: finds the Twilio IncomingPhoneNumber by E.164, then sets its VoiceUrl to:
 *   {domain}/api/voice/twilio/incoming?key=...&prompt=...&voice=...&lang=...&greeting=...
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST' });

  try {
    const {
      accountSid,
      authToken,
      phoneNumber,
      domain,
      key,
      prompt = 'You are a concise, friendly Reduc AI phone agent.',
      voice = 'alice',
      lang = 'en-US',
      greeting = 'Reduc A I agent here. After the beep, tell me what you need.',
    } = (req.body || {}) as Record<string, string>;

    if (!accountSid || !authToken || !phoneNumber || !domain || !key) {
      return json(res, 400, { ok: false, error: 'Missing fields (accountSid, authToken, phoneNumber, domain, key).' });
    }

    const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    // 1) Look up the Twilio IncomingPhoneNumber by E.164 to get its SID
    const searchUrl = new URL(
      `/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/IncomingPhoneNumbers.json`,
      'https://api.twilio.com'
    );
    searchUrl.searchParams.set('PhoneNumber', phoneNumber);

    const lookup = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: { Authorization: auth },
    });

    if (!lookup.ok) {
      const text = await lookup.text();
      return json(res, 400, { ok: false, error: 'Failed to query Twilio numbers', details: text });
    }

    const list = (await lookup.json()) as { incoming_phone_numbers?: Array<{ sid: string; phone_number: string }> };
    const match = (list.incoming_phone_numbers || []).find((n) => n.phone_number === phoneNumber);

    if (!match) {
      return json(res, 404, { ok: false, error: 'Number not found in this Twilio account.' });
    }

    // 2) Build the VoiceUrl pointing to your webhook with per-user settings
    const qs = new URLSearchParams({
      key,
      prompt,
      voice,
      lang,
      greeting,
    }).toString();

    // Ensure domain includes protocol and no trailing slash
    const base = domain.replace(/\/+$/, '');
    const voiceUrl = `${base}/api/voice/twilio/incoming?${qs}`;

    // 3) Update the number’s VoiceUrl
    const updateUrl = new URL(
      `/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/IncomingPhoneNumbers/${encodeURIComponent(
        match.sid
      )}.json`,
      'https://api.twilio.com'
    );

    const form = new URLSearchParams({
      VoiceUrl: voiceUrl,
      VoiceMethod: 'POST',
    });

    const update = await fetch(updateUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!update.ok) {
      const text = await update.text();
      return json(res, 400, { ok: false, error: 'Failed to update VoiceUrl', details: text });
    }

    const updated = await update.json();

    return json(res, 200, {
      ok: true,
      data: {
        numberSid: updated.sid,
        phoneNumber,
        voiceUrl,
      },
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || 'Server error' });
  }
}
