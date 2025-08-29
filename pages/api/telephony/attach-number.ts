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
