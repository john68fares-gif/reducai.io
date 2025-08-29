// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string; details?: any };
type TwilioCreds = { accountSid?: string; authToken?: string };

const send = (res: NextApiResponse, code: number, body: Ok<any> | Err) =>
  res
    .status(code)
    .setHeader('Content-Type', 'application/json')
    .end(JSON.stringify(body));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const { agentId, phoneNumber, twilio, siteUrl } = (req.body || {}) as {
      agentId?: string;
      phoneNumber?: string; // E.164
      twilio?: TwilioCreds; // user-supplied OR env fallback
      siteUrl?: string;     // optional override for base URL
    };

    if (!agentId) return send(res, 400, { ok: false, error: 'Missing agentId' });
    if (!phoneNumber) return send(res, 400, { ok: false, error: 'Missing phoneNumber (E.164)' });

    const creds: TwilioCreds = {
      accountSid: twilio?.accountSid || process.env.TWILIO_ACCOUNT_SID,
      authToken:  twilio?.authToken  || process.env.TWILIO_AUTH_TOKEN,
    };
    if (!creds.accountSid || !creds.authToken) {
      return send(res, 400, { ok: false, error: 'Missing Twilio env vars or request credentials' });
    }

    // Resolve public base URL
    const baseUrl =
      siteUrl ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['host']}`;

    // 1) Lookup the IncomingPhoneNumber SID by E.164
    const listUrl = new URL(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/IncomingPhoneNumbers.json`
    );
    listUrl.searchParams.set('PhoneNumber', phoneNumber);

    const auth = 'Basic ' + Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');

    const listResp = await fetch(listUrl.toString(), {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    if (!listResp.ok) {
      const t = await listResp.text().catch(() => '');
      return send(res, listResp.status, { ok: false, error: 'Twilio lookup failed', details: t });
    }
    const list = (await listResp.json().catch(() => null)) as any;
    const match = Array.isArray(list?.incoming_phone_numbers) ? list.incoming_phone_numbers[0] : null;
    if (!match?.sid)
      return send(res, 404, { ok: false, error: 'Phone number not found in this Twilio account' });
    const phoneSid = match.sid as string;

    // 2) Update VoiceUrl to your inbound webhook
    const voiceUrl = `${baseUrl}/api/voice/inbound?agentId=${encodeURIComponent(agentId)}`;
    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');

    const updResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/IncomingPhoneNumbers/${phoneSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      }
    );

    if (!updResp.ok) {
      const t = await updResp.text().catch(() => '');
      return send(res, updResp.status, { ok: false, error: 'Twilio update failed', details: t });
    }
    const updated = await updResp.json().catch(() => null);

    return send(res, 200, {
      ok: true,
      data: { sid: phoneSid, phoneNumber, voiceUrl, friendlyName: updated?.friendly_name ?? null },
    });
  } catch (e: any) {
    return send(res, 500, { ok: false, error: e?.message || 'Server error' });
  }
}
