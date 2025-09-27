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
  const url = new URL(req.url || '', 'http://local');
  const q = url.searchParams;

  const agent   = q.get('agent') || '';
  const mode    = (q.get('mode') || 'assistant').toLowerCase(); // NEW: 'assistant' | 'user'
  const greetQ  = q.get('greet') || '';                         // may be empty → no greeting
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

  const nextUrl = new URL('/api/voice/twilio/next', base);
  if (agent) nextUrl.searchParams.set('agent', agent);
  nextUrl.searchParams.set('voice', voice);
  nextUrl.searchParams.set('lang', lang);
  nextUrl.searchParams.set('rate', rate);
  nextUrl.searchParams.set('pitch', pitch);
  nextUrl.searchParams.set('delay', delay);
  nextUrl.searchParams.set('barge', barge);

  const sayAttrs = `voice="${xmlEscape(voice)}" language="${xmlEscape(lang)}"`;

  // Build TwiML based on mode:
  // - assistant: optional greeting first, then Gather
  // - user: straight to Gather (no greeting)
  let body = '';

  if (mode === 'assistant' && greetQ) {
    body += `<Say ${sayAttrs}>${xmlEscape(greetQ)}</Say>`;
  }

  // Go straight to gather for user-first (or after greeting)
  body += `<Gather input="speech" action="${xmlEscape(nextUrl.toString())}" method="POST" speechTimeout="auto">` +
            `<Say ${sayAttrs}>${xmlEscape(mode === 'assistant' && greetQ ? 'I\'m listening…' : 'Please speak after the tone. I\'m listening…')}</Say>` +
          `</Gather>`;

  // Optional end
  body += `<Pause length="1"/><Say ${sayAttrs}>Goodbye.</Say><Hangup/>`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
