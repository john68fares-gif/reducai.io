import type { NextApiRequest, NextApiResponse } from 'next';

const xml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
const esc = (s='') => s.replace(/[<>&]/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;'} as any)[m]);
const baseUrl = (req: NextApiRequest) => {
  const proto = (req.headers['x-forwarded-proto'] as string) || (req.headers['x-forwarded-protocol'] as string) || 'https';
  const host  = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string) || '';
  return `${proto}://${host}`.replace(/\/+$/,'');
};

function sayLine(voice:string, lang:string, text:string, delayMs:number, rate:number, pitch:number) {
  const isPolly = /^polly\./i.test(voice);
  const d = Math.max(0, Math.min(5000, Number(delayMs||0)));
  const r = Math.max(60, Math.min(140, Number(rate||100)));
  const p = Math.max(-6, Math.min(6, Number(pitch||0)));
  const pre = !isPolly && d >= 1000 ? `<Pause length="${Math.min(4, Math.round(d/1000))}"/>` : '';
  if (isPolly) {
    const pitchStr = (p >= 0 ? `+${p}` : `${p}`) + 'st';
    const ssml = `${d ? `<break time="${d}ms"/>` : ''}<prosody rate="${r}%" pitch="${pitchStr}">${esc(text)}</prosody>`;
    return `${pre}<Say voice="${esc(voice)}" language="${esc(lang)}">${ssml}</Say>`;
  }
  return `${pre}<Say voice="${esc(voice)}" language="${esc(lang)}">${esc(text)}</Say>`;
}

export default function incoming(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).send('Method Not Allowed'); }

    const base = baseUrl(req);
    const q = req.query || {};
    const lang   = (q.lang  || 'en-US').toString();
    const voice  = (q.voice || 'Polly.Joanna').toString();
    const brand  = (q.brand || '').toString();
    const greet  = (q.greeting || (brand ? `Thank you for calling ${brand}. How can I help today?` : 'Thank you for calling. How can I help today?')).toString();
    const delayMs = Number(q.delayMs ?? 300);
    const rate    = Number(q.rate ?? 100);
    const pitch   = Number(q.pitch ?? 0);

    const keep = new URLSearchParams({ lang, voice, delayMs: String(delayMs), rate: String(rate), pitch: String(pitch), brand });
    const detectUrl = new URL('/api/voice/twilio/ivr', base);
    detectUrl.searchParams.set('step', 'detect');
    for (const [k,v] of keep) detectUrl.searchParams.set(k, v);

    const selfUrl = new URL('/api/voice/twilio/incoming', base);
    for (const [k,v] of keep) selfUrl.searchParams.set(k, v);

    const greetSay = sayLine(voice, lang, greet, delayMs, rate, pitch);
    const tw =
      greetSay +
      `<Gather input="speech" language="${esc(lang)}" timeout="7" speechTimeout="auto"
               action="${esc(detectUrl.toString())}" method="POST">
         <Say voice="${esc(voice)}" language="${esc(lang)}">
           Please tell me what you need help with — for example, schedule a new appointment, reschedule, or cancel.
         </Say>
       </Gather>
       <Redirect method="POST">${esc(selfUrl.toString())}</Redirect>`;

    res.status(200).setHeader('Content-Type','text/xml').send(xml(tw));
  } catch {
    res.status(200).setHeader('Content-Type','text/xml')
      .send(xml(`<Say voice="alice">Sorry, something went wrong.</Say><Hangup/>`));
  }
}
