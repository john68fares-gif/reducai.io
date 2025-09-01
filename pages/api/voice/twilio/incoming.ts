// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/** Next's JSON bodyParser doesn't parse Twilio form posts; read raw body if needed */
export const config = { api: { bodyParser: false } };

function xmlEscape(s: string) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function baseUrl(req: NextApiRequest) {
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https';
  const host = (req.headers['x-forwarded-host'] as string) || (req.headers['host'] as string) || '';
  const envBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  return envBase || (host ? `${proto}://${host}` : '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Pull config from query (set by attach-number.ts)
  const url = new URL(req.url || '', 'http://local');
  const q = url.searchParams;

  const agent   = q.get('agent') || '';
  const greet   = q.get('greet') || 'Hello! Your AI agent is connected.';
  const voice   = q.get('voice') || 'Polly.Joanna';
  const lang    = q.get('lang')  || 'en-US';
  const rate    = q.get('rate')  || '100';
  const pitch   = q.get('pitch') || '0';
  const delay   = q.get('delay') || '600';
  const barge   = q.get('barge') || '1';

  const base = baseUrl(req);
  if (!base) {
    res.status(500).json({ error: 'No PUBLIC_BASE_URL and no Host header; cannot build absolute URLs.' } as any);
    return;
  }

  // Keep params when we POST to the next step
  const nextUrl = new URL('/api/voice/twilio/next', base);
  if (agent) nextUrl.searchParams.set('agent', agent);
  nextUrl.searchParams.set('voice', voice);
  nextUrl.searchParams.set('lang', lang);
  nextUrl.searchParams.set('rate', rate);
  nextUrl.searchParams.set('pitch', pitch);
  nextUrl.searchParams.set('delay', delay);
  nextUrl.searchParams.set('barge', barge);

  const sayAttrs = `voice="${xmlEscape(voice)}" language="${xmlEscape(lang)}"`;

  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
      // Optional prosody controls; TwiML doesn't support rate/pitch attributes directly across all voices,
      // so keep it simple and just <Say>. You can move to <Play> with generated audio later.
      `<Say ${sayAttrs}>${xmlEscape(greet)}</Say>` +

      // Prompt the caller so you can verify speech → webhook is working
      `<Gather input="speech" action="${xmlEscape(nextUrl.toString())}" method="POST" speechTimeout="auto">` +
        `<Say ${sayAttrs}>How can I help you today?</Say>` +
      `</Gather>` +

      `<Pause length="1"/>` +
      `<Say ${sayAttrs}>Goodbye.</Say>` +
      `<Hangup/>` +
    `</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
