import type { NextApiRequest, NextApiResponse } from 'next';

type Ok<T>  = { ok: true; data: T };
type Err    = { ok: false; error: string };
type Result = Ok<{ phoneNumber: string; voiceUrl: string; fallbackUrl: string }>;

const E164 = /^\+[1-9]\d{1,14}$/;
const isSid = (s?: string) => !!s && /^AC[a-zA-Z0-9]{32}$/.test(s);

function baseUrl(req: NextApiRequest) {
  const proto = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-protocol'] as string) || 'https';
  const host  = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string) || '';
  if (!host) throw new Error('Could not detect public host.');
  return `${proto}://${host}`.replace(/\/+$/,'');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Result|Err>) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ ok:false, error:'Use POST with JSON body.' }); }
  try {
    const b: any = req.body || {};
    const accountSid = b.accountSid || b?.credentials?.accountSid;
    const authToken  = b.authToken  || b?.credentials?.authToken;
    const phoneNumber = b.phoneNumber as string;

    // voice/biz config
    const lang  = (b.language || 'en-US').toString();
    const voice = (b.voice || 'Polly.Joanna').toString();
    const greeting = (b.greeting || 'Thank you for calling. How can I help today?').toString();
    const delayMs = String(Math.max(0, Math.min(5000, Number(b.delayMs ?? 300))));
    const rate    = String(Math.max(60, Math.min(140, Number(b.rate ?? 100))));
    const pitch   = String(Math.max(-6, Math.min(6, Number(b.pitch ?? 0))));
    const style   = (b.style || '').toString();
    const brand   = (b.brand || '').toString();
    const botId   = (b.botId || '').toString();

    if (!isSid(accountSid)) return res.status(400).json({ ok:false, error:'Invalid or missing Twilio Account SID.' });
    if (!authToken)         return res.status(400).json({ ok:false, error:'Missing Twilio Auth Token.' });
    if (!phoneNumber || !E164.test(phoneNumber)) return res.status(400).json({ ok:false, error:'Phone number must be E.164.' });

    const base = baseUrl(req);
    const voiceUrlObj = new URL('/api/voice/twilio/incoming', base);
    [['lang',lang],['voice',voice],['greeting',greeting],['delayMs',delayMs],['rate',rate],['pitch',pitch],['style',style],['brand',brand],['botId',botId]]
      .forEach(([k,v])=> v && voiceUrlObj.searchParams.set(k as string, v as string));
    const voiceUrl = voiceUrlObj.toString();
    const fallbackUrl = new URL('/api/voice/twilio/ping', base).toString();

    // Twilio REST
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const apiBase = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;

    // lookup
    const listUrl = `${apiBase}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`;
    const listResp = await fetch(listUrl, { headers:{ Authorization: authHeader }});
    if (!listResp.ok) return res.status(listResp.status).json({ ok:false, error:`Twilio lookup failed: ${await listResp.text().catch(()=>listResp.statusText)}` });
    const listJson: any = await listResp.json();
    const match = Array.isArray(listJson?.incoming_phone_numbers) ? listJson.incoming_phone_numbers[0] : null;
    if (!match?.sid) return res.status(404).json({ ok:false, error:`Twilio number not found: ${phoneNumber}` });

    // update
    const form = new URLSearchParams();
    form.set('VoiceUrl', voiceUrl);
    form.set('VoiceMethod', 'POST');
    form.set('VoiceFallbackUrl', fallbackUrl);
    form.set('VoiceFallbackMethod', 'POST');

    const updResp = await fetch(`${apiBase}/IncomingPhoneNumbers/${match.sid}.json`, {
      method:'POST',
      headers:{ Authorization: authHeader, 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString(),
    });
    if (!updResp.ok) return res.status(updResp.status).json({ ok:false, error:`Twilio update failed: ${await updResp.text().catch(()=>updResp.statusText)}` });

    return res.status(200).json({ ok:true, data:{ phoneNumber, voiceUrl, fallbackUrl } });
  } catch (e:any) {
    return res.status(500).json({ ok:false, error: e?.message || 'Unexpected server error.' });
  }
}
