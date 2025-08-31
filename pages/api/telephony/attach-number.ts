// pages/api/telephony/attach-number.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };
type Result = Ok<{ phoneNumber: string; voiceUrl: string; fallbackUrl: string }>;

const E164 = /^\+[1-9]\d{1,14}$/;
const isSid = (s?: string) => !!s && /^AC[a-zA-Z0-9]{32}$/.test(s);

function getBaseUrl(req: NextApiRequest) {
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) || '';
  if (!host) throw new Error('Could not detect public host.');
  return `${proto}://${host}`.replace(/\/+$/, '');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Result | Err>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Use POST with JSON body.' });
  }

  try {
    const b = (req.body || {}) as any;

    const accountSid = b.accountSid || b?.credentials?.accountSid;
    const authToken  = b.authToken  || b?.credentials?.authToken;
    const phoneNumber = b.phoneNumber as string;

    // Voice config (optional)
    const lang     = (b.language || 'en-US').toString();
    const voice    = (b.voice || 'Polly.Joanna').toString();
    const greeting = (b.greeting || 'Thank you for calling. How can I help today?').toString();
    const delayMs  = String(Math.max(0, Math.min(5000, Number(b.delayMs ?? 300))));
    const rate     = String(Math.max(60, Math.min(140, Number(b.rate ?? 100))));
    const pitch    = String(Math.max(-6, Math.min(6, Number(b.pitch ?? 0))));
    const style    = (b.style || '').toString();

    if (!isSid(accountSid)) return res.status(400).json({ ok:false, error:'Invalid or missing Twilio Account SID.' });
    if (!authToken)         return res.status(400).json({ ok:false, error:'Missing Twilio Auth Token.' });
    if (!phoneNumber || !E164.test(phoneNumber)) {
      return res.status(400).json({ ok:false, error:'Phone number must be E.164 like +15551234567.' });
    }

    const baseUrl = getBaseUrl(req);
    const voiceUrlObj = new URL('/api/voice/twilio/incoming', baseUrl);
    voiceUrlObj.searchParams.set('lang', lang);
    voiceUrlObj.searchParams.set('voice', voice);
    voiceUrlObj.searchParams.set('greeting', greeting);
    voiceUrlObj.searchParams.set('delayMs', delayMs);
    voiceUrlObj.searchParams.set('rate', rate);
    voiceUrlObj.searchParams.set('pitch', pitch);
    voiceUrlObj.searchParams.set('style', style);
    const voiceUrl = voiceUrlObj.toString();

    const fallbackUrl = new URL('/api/voice/twilio/ping', baseUrl).toString();

    // Twilio REST
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // 1) lookup number SID
    const listUrl = `${apiBase}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const listResp = await fetch(listUrl, { method:'GET', headers:{ Authorization: authHeader }});
    if (!listResp.ok) {
      const txt = await listResp.text().catch(()=>`${listResp.status} ${listResp.statusText}`);
      return res.status(listResp.status).json({ ok:false, error:`Twilio lookup failed: ${txt}` });
    }
    const listJson: any = await listResp.json();
    const match = Array.isArray(listJson?.incoming_phone_numbers) ? listJson.incoming_phone_numbers[0] : null;
    if (!match?.sid) return res.status(404).json({ ok:false, error:`Twilio number not found: ${phoneNumber}` });

    // 2) update VoiceUrl (+ fallback)
    const updateUrl = `${apiBase}/IncomingPhoneNumbers/${match.sid}.json`;
    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');
    form.set('VoiceFallbackUrl', fallbackUrl);
    form.set('VoiceFallbackMethod', 'POST');

    const updResp = await fetch(updateUrl, {
      method:'POST',
      headers:{ Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString(),
    });
    if (!updResp.ok) {
      const txt = await updResp.text().catch(()=>`${updResp.status} ${updResp.statusText}`);
      return res.status(updResp.status).json({ ok:false, error:`Twilio update failed: ${txt}` });
    }

    return res.status(200).json({ ok:true, data:{ phoneNumber, voiceUrl, fallbackUrl } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error: e?.message || 'Unexpected server error.' });
  }
}
