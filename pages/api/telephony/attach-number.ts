// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string; hint?: string; details?: any };

function json<T>(res: NextApiResponse, body: Ok<T> | Err, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
}

function requireFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[]) {
  const miss = fields.filter((k) => !obj[k]);
  if (miss.length) throw new Error(`Missing field(s): ${miss.join(', ')}`);
}

function basicAuthHeader(sid: string, token: string) {
  // Twilio uses HTTP Basic (sid:token)
  const b = Buffer.from(`${sid}:${token}`).toString('base64');
  return `Basic ${b}`;
}

async function findIncomingNumberSid(
  accountSid: string,
  authToken: string,
  e164: string
): Promise<string | null> {
  const url = new URL(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`
  );
  url.searchParams.set('PhoneNumber', e164);

  const r = await fetch(url.toString(), {
    headers: { Authorization: basicAuthHeader(accountSid, authToken) },
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Twilio lookup failed (${r.status}). ${text || ''}`.trim());
  }

  const j = await r.json().catch(() => null);
  const sid = j?.incoming_phone_numbers?.[0]?.sid as string | undefined;
  return sid || null;
}

async function updateIncomingNumber(
  accountSid: string,
  authToken: string,
  phoneSid: string,
  params: Record<string, string>
) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneSid}.json`;
  const form = new URLSearchParams(params);

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(accountSid, authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Twilio update failed (${r.status}). ${text || ''}`.trim());
  }
  return r.json();
}

// POST /api/telephony/attach-number
// Body: { accountSid, authToken, phoneNumber, agentId, baseUrl? }
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return json(res, { ok: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { accountSid, authToken, phoneNumber, agentId, baseUrl } = req.body || {};

    requireFields(
      { accountSid, authToken, phoneNumber, agentId },
      ['accountSid', 'authToken', 'phoneNumber', 'agentId']
    );

    // Basic sanity checks
    if (!/^AC[a-zA-Z0-9]{32}$/.test(accountSid)) {
      return json(res, { ok: false, error: 'Invalid Twilio Account SID', hint: 'Must start with AC and be 34 chars.' }, 400);
    }
    if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      return json(res, { ok: false, error: 'Invalid E.164 phone number', hint: 'Example: +15555550123' }, 400);
    }

    // Voice webhook we will set on the number
    // Default to your current origin if baseUrl not passed
    const origin =
      (typeof baseUrl === 'string' && /^https?:\/\//i.test(baseUrl) ? baseUrl : '') ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;

    const voiceUrl = `${origin}/api/voice/twilio/incoming?agent=${encodeURIComponent(agentId)}`;

    // 1) Find the phone SID for that E.164 on the user’s account
    const phoneSid = await findIncomingNumberSid(accountSid, authToken, phoneNumber);
    if (!phoneSid) {
      return json(
        res,
        { ok: false, error: 'Twilio number not found on this account', hint: 'Make sure the number belongs to the provided account SID.' },
        404
      );
    }

    // 2) Update the number to point to our webhook
    await updateIncomingNumber(accountSid, authToken, phoneSid, {
      VoiceUrl: voiceUrl,
      VoiceMethod: 'POST',
      // Optional: set a friendly name that includes your agent id
      FriendlyName: `Agent:${agentId}`,
    });

    return json(res, { ok: true, data: { attached: true, phoneSid, voiceUrl } });
  } catch (e: any) {
    return json(res, { ok: false, error: e?.message || 'Attach failed' }, 500);
  }
}
