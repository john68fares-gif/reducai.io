// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Env = {
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
};
type BodyIn = { agentId?: string; phoneNumber?: string };
type Out = { ok: true } | { ok: false; error: string };

function baseUrlFromEnv(req: NextApiRequest) {
  // Prefer explicit base url; fall back to Vercel's
  const v = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL;
  const host = v || req.headers.host || '';
  return host.startsWith('http') ? host : `https://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Out>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env as Env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return res.status(500).json({ ok: false, error: 'Missing Twilio env vars' });
  }

  const { agentId, phoneNumber } = (req.body || {}) as BodyIn;
  if (!agentId || !phoneNumber) {
    return res.status(400).json({ ok: false, error: 'agentId and phoneNumber required' });
  }

  const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  try {
    // 1) Find the number SID by E.164
    const searchUrl =
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json` +
      `?PhoneNumber=${encodeURIComponent(phoneNumber)}`;

    const listResp = await fetch(searchUrl, {
      headers: { Authorization: authHeader }
    });

    if (!listResp.ok) {
      const t = await listResp.text();
      throw new Error(`Twilio search failed: ${listResp.status} ${t}`);
    }
    const listJson: any = await listResp.json();
    const phone = listJson?.incoming_phone_numbers?.[0];
    if (!phone?.sid) throw new Error('Number not found on your Twilio account');

    // 2) Set Voice URL to your webhook, pass agentId as query param
    const base = baseUrlFromEnv(req);
    const voiceUrl = `${base}/api/voice/twilio/incoming?agentId=${encodeURIComponent(agentId)}`;

    const updateUrl =
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${phone.sid}.json`;

    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');

    const updResp = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    if (!updResp.ok) {
      const t = await updResp.text();
      throw new Error(`Twilio update failed: ${updResp.status} ${t}`);
      // optional: handle 400s for numbers without voice capability
    }

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'Attach failed' });
  }
}
