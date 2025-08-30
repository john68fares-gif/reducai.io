// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const xml = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const esc = (s = '') => s.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'} as any)[m]);

function buildGreetingSSML(opts:{
  text: string; style?: string; ratePct?: number; pitchSt?: number; delayMs?: number;
}) {
  const rate = Math.max(60, Math.min(140, Number(opts.ratePct ?? 100)));
  const pitch = Math.max(-6, Math.min(6, Number(opts.pitchSt ?? 0)));
  const delay = Math.max(0, Math.min(5000, Number(opts.delayMs ?? 0)));
  const domain = opts.style === 'newscaster' ? 'news'
               : (opts.style === 'conversational' ? 'conversational'
               : (opts.style === 'professional' ? '' : (opts.style || '')));
  const open = domain ? `<amazon:domain name="${domain}">` : '';
  const close = domain ? `</amazon:domain>` : '';
  const breakTag = delay ? `<break time="${delay}ms"/>` : '';
  const pitchStr = (pitch >= 0 ? `+${pitch}` : `${pitch}`) + 'st';
  const text = esc(opts.text || 'Thank you for calling. How can I help today?');

  // SSML inside <Say>
  return `${breakTag}${open}<prosody rate="${rate}%" pitch="${pitchStr}">${text}</prosody>${close}`;
}

export default function incoming(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).send('Method Not Allowed');
    }

    // read config (from attach-number query params)
    const q = req.query || {};
    const lang    = (q.lang  || 'en-US').toString();
    const voice   = (q.voice || 'Polly.Joanna').toString();
    const style   = (q.style || '').toString();
    const greet   = (q.greeting || 'Thank you for calling. How can I help today?').toString();
    const delayMs = Number(q.delayMs ?? 300);
    const rate    = Number(q.rate ?? 100);
    const pitch   = Number(q.pitch ?? 0);
    const bargeIn = q.bargeIn === '1' || q.bargeIn === 'true';

    const greetSSML = buildGreetingSSML({
      text: greet, style, ratePct: rate, pitchSt: pitch, delayMs: delayMs,
    });

    // Build a reusable <Say> prefix for all prompts
    const say = (textSSML: string) =>
      `<Say voice="${esc(voice)}" language="${esc(lang)}">${textSSML}</Say>`;

    // After greeting → main menu (speech or DTMF)
    const menuPrompt = buildGreetingSSML({
      text:
        'For a new appointment, press 1 or say "new". ' +
        'To reschedule, press 2 or say "reschedule". ' +
        'To cancel, press 3 or say "cancel". ' +
        'To speak to the front desk, press 0.',
      style, ratePct: rate, pitchSt: pitch, delayMs: 0
    });

    const keepParams = new URLSearchParams({
      lang: lang, voice: voice, style: style,
      rate: String(rate), pitch: String(pitch), delayMs: String(delayMs),
      bargeIn: bargeIn ? '1' : '0'
    }).toString();

    const twiml =
      say(greetSSML) +
      `<Gather input="speech dtmf" 
               language="${esc(lang)}"
               hints="new,reschedule,cancel,front desk"
               timeout="6"
               speechTimeout="auto"
               bargeIn="${bargeIn ? 'true' : 'false'}"
               action="/api/voice/twilio/ivr?step=menu&${esc(keepParams)}"
               method="POST">
          ${say(menuPrompt)}
       </Gather>
       <Redirect method="POST">/api/voice/twilio/incoming?${esc(keepParams)}</Redirect>`;

    res.status(200).setHeader('Content-Type','text/xml').send(xml(twiml));
  } catch (e:any) {
    res.status(200).setHeader('Content-Type','text/xml')
      .send(xml(`<Say voice="alice">Sorry, something went wrong.</Say><Hangup/>`));
  }
}
