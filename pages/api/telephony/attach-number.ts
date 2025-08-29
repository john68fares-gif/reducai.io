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

export default async function attachNumberHandler(
  req: NextApiRequest,
  res: NextApiResponse<Result | Err>
) {
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
