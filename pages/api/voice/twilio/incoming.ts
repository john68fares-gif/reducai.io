// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

function twiml(innerXml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${innerXml}</Response>`;
}
function xmlSafe(s: string) {
  return (s || '').replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' } as any)[c]);
}
function sayAndHangup(msg: string, voice: string, lang: string) {
  return twiml(`<Say voice="${xmlSafe(voice)}" language="${xmlSafe(lang)}">${xmlSafe(msg)}</Say><Hangup/>`);
}

// Build SSML that Twilio <Say> understands (Amazon Polly tags allowed)
function buildGreetingSSML(opts:{
  text: string; style?: string; ratePct?: number; pitchSt?: number; delayMs?: number;
}) {
  const text = xmlSafe(opts.text || 'Thank you for calling. How can I help today?');
  const rate = Math.max(60, Math.min(140, Number(opts.ratePct ?? 100)));
  const pitch = Math.max(-6, Math.min(6, Number(opts.pitchSt ?? 0)));
  const delay = Math.max(0, Math.min(5000, Number(opts.delayMs ?? 0)));

  // Map UI style to Polly domain names
  const domain = opts.style === 'newscaster' ? 'news'
               : (opts.style === 'conversational' ? 'conversational'
               : (opts.style === 'professional' ? '' : (opts.style || '')));

  const openDom = domain ? `<amazon:domain name="${domain}">` : '';
  const closeDom = domain ? `</amazon:domain>` : '';
  const breakTag = delay ? `<break time="${delay}ms"/>` : '';
  const pitchStr = (pitch >= 0 ? `+${pitch}` : `${pitch}`) + 'st';

  // Twilio supports SSML inside <Say>. We don’t wrap with <speak>.
  return `${breakTag}${openDom}<prosody rate="${rate}%" pitch="${pitchStr}">${text}</prosody>${closeDom}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).send('Method Not Allowed');
    }

    const q = req.query || {};
    const agentId = (q.agentId || req.body?.agentId || '').toString().trim();

    const lang   = (q.lang   || 'en-US').toString();
    const voice  = (q.voice  || 'Polly.Joanna').toString();
    const style  = (q.style  || '').toString();                // conversational | professional | newscaster | ''
    const greet  = (q.greeting || 'Thank you for calling. How can I help today?').toString();
    const delay  = Number(q.delayMs ?? 0);
    const rate   = Number(q.rate ?? 100);
    const pitch  = Number(q.pitch ?? 0);
    const bargeIn = (q.bargeIn === '1' || q.bargeIn === 'true');

    const greetSSML = buildGreetingSSML({
      text: greet, style, ratePct: rate, pitchSt: pitch, delayMs: delay,
    });

    const vapiKey = process.env.VAPI_API_KEY?.trim();
    const wsBase  = (process.env.VAPI_WS_BASE || 'wss://api.vapi.ai').trim();

    // Build the part that always plays (professional, stable greeting)
    let xml = `<Say voice="${xmlSafe(voice)}" language="${xmlSafe(lang)}">${greetSSML}</Say>`;

    // If we’re configured for Vapi, connect the Twilio media stream
    if (agentId && vapiKey) {
      const streamUrl = `${wsBase}/v1/twilio?assistantId=${encodeURIComponent(agentId)}&apiKey=${encodeURIComponent(vapiKey)}&lang=${encodeURIComponent(lang)}&voice=${encodeURIComponent(voice)}&style=${encodeURIComponent(style)}&rate=${encodeURIComponent(String(rate))}&pitch=${encodeURIComponent(String(pitch))}&delayMs=${encodeURIComponent(String(delay))}&bargeIn=${bargeIn ? '1':'0'}`;

      // pass caller/callee metadata from Twilio, if present
      const startParams: Record<string, string> = {};
      const from = (req.body?.From || '').toString();
      const to   = (req.body?.To   || '').toString();
      if (from) startParams['from'] = from;
      if (to)   startParams['to']   = to;
      if (bargeIn) startParams['bargeIn'] = 'true';

      const paramsXml = Object.entries(startParams)
        .map(([name, value]) => `<Parameter name="${xmlSafe(name)}" value="${xmlSafe(value)}"/>`)
        .join('');

      xml += `<Connect><Stream url="${xmlSafe(streamUrl)}">${paramsXml}</Stream></Connect>`;
    } else {
      // No backend configured — end gracefully after greeting
      xml += `<Pause length="1"/><Hangup/>`;
    }

    return res.status(200).setHeader('Content-Type','text/xml').send(twiml(xml));
  } catch (e:any) {
    // As a last resort, still return TwiML so Twilio never says “Application Error”
    return res
      .status(200)
      .setHeader('Content-Type','text/xml')
      .send(sayAndHangup('Sorry, the assistant is temporarily unavailable.', 'alice', 'en-US'));
  }
}
