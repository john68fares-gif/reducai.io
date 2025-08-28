// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Json = { ok: true; data?: any } | { ok: false; error: string; details?: any };

// simple helpers
const json = (res: NextApiResponse<Json>, code: number, body: Json) =>
  res.status(code).json(body);
const isE164 = (s: string) => /^\+[1-9]\d{1,14}$/.test(s || '');

export default async function handler(req: NextApiRequest, res: NextApiResponse<Json>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const { agentId, phoneNumber, twilio } = (req.body || {}) as {
      agentId?: string;
      phoneNumber?: string; // E.164
      twilio?: { accountSid?: string; authToken?: string } | null;
    };

    if (!agentId)        return json(res, 400, { ok: false, error: 'agentId is required', details: { field: 'agentId' } });
    if (!isE164(phoneNumber || '')) {
      return json(res, 400, { ok: false, error: 'phoneNumber must be E.164 (+15551234567)', details: { field: 'phoneNumber' } });
    }

    // allow per-user keys OR fall back to env
    const accountSid = twilio?.accountSid || process.env.TWILIO_ACCOUNT_SID || '';
    const authToken  = twilio?.authToken  || process.env.TWILIO_AUTH_TOKEN  || '';

    if (!accountSid || !authToken) {
      return json(res, 400, {
        ok: false,
        error: 'Missing Twilio env vars',
        details: {
          message: 'Provide twilio.accountSid & twilio.authToken in the request body OR set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your environment.',
          need: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
        },
      });
    }

    // figure out our public base URL (Vercel-aware)
    const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
    const host  = (req.headers['x-forwarded-host'] as string)  || req.headers.host || 'localhost:3000';
    const base  = `${proto}://${host}`;

    // Twilio REST via fetch (no SDK required)
    const basicAuth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    // 1) find the IncomingPhoneNumber SID for this E.164
    const listUrl = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`);
    listUrl.searchParams.set('PhoneNumber', phoneNumber!);

    const listResp = await fetch(listUrl.toString(), {
      method: 'GET',
      headers: { Authorization: basicAuth },
    });

    if (!listResp.ok) {
      const txt = await listResp.text();
      return json(res, listResp.status, { ok: false, error: 'Twilio list error', details: txt });
    }

    const listJson: any = await listResp.json().catch(() => ({}));
    const item = Array.isArray(listJson?.incoming_phone_numbers) && listJson.incoming_phone_numbers[0];
    if (!item?.sid) {
      return json(res, 404, {
        ok: false,
        error: 'Number not found in Twilio account',
        details: { phoneNumber },
      });
    }

    const pnSid: string = item.sid;

    // 2) set the VoiceUrl to our webhook (POST)
    const voiceUrl = `${base}/api/voice/inbound?agentId=${encodeURIComponent(agentId)}`;

    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');

    const updResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${pnSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      }
    );

    if (!updResp.ok) {
      const txt = await updResp.text();
      return json(res, updResp.status, { ok: false, error: 'Twilio update error', details: txt });
    }

    const updJson = await updResp.json().catch(() => ({}));
    return json(res, 200, {
      ok: true,
      data: {
        phoneNumber,
        agentId,
        voiceUrl,
        twilioSid: pnSid,
        twilioResponse: { friendlyName: updJson?.friendly_name, voiceUrl: updJson?.voice_url },
      },
    });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: e?.message || 'Unexpected error' });
  }
}
