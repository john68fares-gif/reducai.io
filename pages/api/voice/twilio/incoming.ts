// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const xmlWrap = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const esc = (s = '') => s.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'} as any)[m]);

function buildGreeting(voice: string, lang: string, text: string, delayMs: number, rate: number, pitch: number) {
  const isPolly = /^polly\./i.test(voice);
  const safeDelay = Math.max(0, Math.min(5000, Number(delayMs || 0)));
  const safeRate  = Math.max(60, Math.min(140, Number(rate || 100)));
  const safePitch = Math.max(-6, Math.min(6, Number(pitch || 0)));

  // Delay before speaking
  const prePause = !isPolly && safeDelay >= 1000 ? `<Pause length="${Math.min(4, Math.round(safeDelay/1000))}"/>` : '';

  // If Polly.*, we can safely use <prosody> and <break/>
  if (isPolly) {
    const pitchStr = (safePitch >= 0 ? `+${safePitch}` : `${safePitch}`) + 'st';
    const ssml = `${safeDelay ? `<break time="${safeDelay}ms"/>` : ''}<prosody rate="${safeRate}%" pitch="${pitchStr}">${esc(text)}</prosody>`;
    return `${prePause}<Say voice="${esc(voice)}" language="${esc(lang)}">${ssml}</Say>`;
  }

  // Safe, plain speech (no SSML for alice/others)
  return `${prePause}<Say voice="${esc(voice)}" language="${esc(lang)}">${esc(text)}</Say>`;
}

export default function incoming(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).send('Method Not Allowed');
    }

    const q = req.query || {};
    const lang    = (q.lang  || 'en-US').toString();
    const voice   = (q.voice || 'Polly.Joanna').toString();
    const style   = (q.style || '').toString(); // kept for future; not used to avoid parser issues
    const greet   = (q.greeting || 'Thank you for calling. How can I help today?').toString();
    const delayMs = Number(q.delayMs ?? 300);
    const rate    = Number(q.rate ?? 100);
    const pitch   = Number(q.pitch ?? 0);

    const greetingSay = buildGreeting(voice, lang, greet, delayMs, rate, pitch);

    const keep = new URLSearchParams({
      lang: lang, voice: voice,
      rate: String(rate), pitch: String(pitch), delayMs: String(delayMs),
      style: style, // passthrough (unused)
    }).toString();

    const twiml =
      greetingSay +
      `<Gather input="speech dtmf"
               language="${esc(lang)}"
               hints="new,reschedule,cancel,front desk"
               timeout="6"
               speechTimeout="auto"
               action="/api/voice/twilio/ivr?step=menu&${esc(keep)}"
               method="POST">
          <Say voice="${esc(voice)}" language="${esc(lang)}">For a new appointment, press 1 or say new. To reschedule, press 2 or say reschedule. To cancel, press 3 or say cancel. To speak to the front desk, press 0.</Say>
       </Gather>
       <Redirect method="POST">/api/voice/twilio/incoming?${esc(keep)}</Redirect>`;

    res.status(200).setHeader('Content-Type','text/xml').send(xmlWrap(twiml));
  } catch {
    res
      .status(200)
      .setHeader('Content-Type','text/xml')
      .send(xmlWrap(`<Say voice="alice">Sorry, something went wrong.</Say><Hangup/>`));
  }
}
