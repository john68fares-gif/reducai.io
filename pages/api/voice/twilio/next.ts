// pages/api/voice/twilio/next.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = { api: { bodyParser: false } };

function xmlEscape(s: string) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Read Twilio's form-encoded POST body
async function readForm(req: NextApiRequest): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve());
    req.on('error', (e) => reject(e));
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  return new URLSearchParams(raw);
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

  const voice = q.get('voice') || 'Polly.Joanna';
  const lang  = q.get('lang')  || 'en-US';

  let speech = '';
  try {
    const form = await readForm(req);
    speech = form.get('SpeechResult') || '';
  } catch {
    // ignore — we'll just say we didn't catch that
  }
  const heard = speech.trim() ? `You said: ${speech.trim()}` : `I didn’t catch that.`;

  // Loop back to the main incoming handler so you can keep testing
  const base = baseUrl(req);
  const backUrl = new URL('/api/voice/twilio/incoming', base);
  // Preserve original params if they existed
  ['agent','voice','lang','rate','pitch','delay','barge'].forEach((k) => {
    const v = q.get(k);
    if (v) backUrl.searchParams.set(k, v);
  });

  const sayAttrs = `voice="${xmlEscape(voice)}" language="${xmlEscape(lang)}"`;
  const twiml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response>` +
      `<Say ${sayAttrs}>${xmlEscape(heard)}</Say>` +
      `<Redirect method="POST">${xmlEscape(backUrl.toString())}</Redirect>` +
    `</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
}
