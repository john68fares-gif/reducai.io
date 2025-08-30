// pages/api/voice/twilio/incoming.ts
// Minimal interactive voice flow using Twilio <Gather input="speech">.
// No third-party SDKs. No env vars. Stateless via query params.
// Works on Vercel. Handles both GET and POST from Twilio.

import type { NextApiRequest, NextApiResponse } from 'next';

type Ctx = {
  intent?: string;
  date?: string;
  time?: string;
  name?: string;
};

function escapeXml(s: string) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' } as any)[c]
  );
}

function baseUrl(req: NextApiRequest) {
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['host'] as string) ||
    '';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

function sendTwiML(res: NextApiResponse, innerXml: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${innerXml}</Response>`;
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.status(200).send(xml);
}

function gather(url: string, prompt: string, opts?: { language?: string }) {
  const lang = opts?.language || 'en-US';
  // speechTimeout="auto" lets Twilio decide when to stop listening.
  return `
    <Gather input="speech" language="${lang}" action="${escapeXml(url)}" method="POST" speechTimeout="auto">
      <Say voice="alice">${escapeXml(prompt)}</Say>
    </Gather>
    <Say voice="alice">I didn't get that.</Say>
    <Redirect method="POST">${escapeXml(url)}</Redirect>
  `;
}

function q(req: NextApiRequest, key: string) {
  const b: any = req.body || {};
  const v = (req.query as any)[key] ?? b[key];
  return typeof v === 'string' ? v : '';
}

function speech(req: NextApiRequest) {
  const b: any = req.body || {};
  // Twilio sends SpeechResult for <Gather input="speech">
  return (b.SpeechResult || '').toString().trim();
}

function nextUrl(req: NextApiRequest, step: string, ctx: Ctx) {
  const url = new URL(baseUrl(req) + '/api/voice/twilio/incoming');
  url.searchParams.set('step', step);
  if (ctx.intent) url.searchParams.set('intent', ctx.intent);
  if (ctx.date)   url.searchParams.set('date', ctx.date);
  if (ctx.time)   url.searchParams.set('time', ctx.time);
  if (ctx.name)   url.searchParams.set('name', ctx.name);
  return url.toString();
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Accept both GET and POST (initial hit might be POST per your attach route).
  const step = q(req, 'step') || 'intro';
  const language = 'en-US'; // keep simple; could be dynamic

  // Build context from query each hop (stateless)
  const ctx: Ctx = {
    intent: q(req, 'intent'),
    date:   q(req, 'date'),
    time:   q(req, 'time'),
    name:   q(req, 'name'),
  };

  try {
    if (step === 'intro') {
      const url = nextUrl(req, 'intent', ctx);
      return sendTwiML(
        res,
        gather(
          url,
          'Thanks for calling. How can I help today? You can say schedule an appointment, reschedule, or cancel.',
          { language }
        )
      );
    }

    if (step === 'intent') {
      const said = speech(req) || ctx.intent || '';
      ctx.intent = said || 'schedule an appointment';
      const url = nextUrl(req, 'date', ctx);
      return sendTwiML(
        res,
        gather(url, `Got it — ${ctx.intent}. What date would you like?`, { language })
      );
    }

    if (step === 'date') {
      const said = speech(req) || ctx.date || '';
      ctx.date = said || 'next available';
      const url = nextUrl(req, 'time', ctx);
      return sendTwiML(
        res,
        gather(url, `Okay, ${ctx.date}. What time of day works best?`, { language })
      );
    }

    if (step === 'time') {
      const said = speech(req) || ctx.time || '';
      ctx.time = said || 'any time';
      const url = nextUrl(req, 'name', ctx);
      return sendTwiML(
        res,
        gather(url, `Great. May I have your full name?`, { language })
      );
    }

    if (step === 'name') {
      const said = speech(req) || ctx.name || '';
      ctx.name = said || 'Unknown';
      const url = nextUrl(req, 'confirm', ctx);
      const summary = `You want to ${ctx.intent}, on ${ctx.date}, around ${ctx.time}. Name: ${ctx.name}. Should I submit this request? Say yes or no.`;
      return sendTwiML(res, gather(url, summary, { language }));
    }

    if (step === 'confirm') {
      const said = (speech(req) || '').toLowerCase();
      const yes = /^(y|yes|yeah|yep|sure|confirm|ok|okay)/.test(said);
      if (yes) {
        // Here you would normally hit your scheduling backend.
        // For now, we confirm and end cleanly.
        return sendTwiML(
          res,
          `<Say voice="alice">Thanks ${escapeXml(ctx.name || '')}. Your request has been submitted for ${escapeXml(ctx.date || '')} around ${escapeXml(ctx.time || '')}. You'll receive a follow up shortly.</Say><Hangup/>`
        );
      } else {
        // Restart flow
        const url = nextUrl(req, 'intro', {});
        return sendTwiML(
          res,
          `<Say voice="alice">No problem. Let's start over.</Say><Redirect method="POST">${escapeXml(url)}</Redirect>`
        );
      }
    }

    // Fallback: restart
    const url = nextUrl(req, 'intro', {});
    return sendTwiML(
      res,
      `<Say voice="alice">Let’s try again.</Say><Redirect method="POST">${escapeXml(url)}</Redirect>`
    );
  } catch {
    // Even on error, return valid TwiML to avoid Twilio "configuration error"
    return sendTwiML(res, `<Say voice="alice">Sorry, something went wrong. Please call again.</Say><Hangup/>`);
  }
}
