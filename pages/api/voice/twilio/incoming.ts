// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

type Data = string; // TwiML XML string

/**
 * This version DOES NOT require env vars.
 * It builds your public base URL from the incoming request headers
 * (x-forwarded-proto/host) so it works on Vercel out of the box.
 *
 * Flow:
 *  1) Answers the call
 *  2) Neutral greeting (no prompt leakage)
 *  3) <Gather> speech and POST to /api/voice/twilio/continue
 *  4) If no speech, <Redirect> to the same /continue
 */

const DEFAULT_GREETING =
  'Hi, thanks for calling. How can I help you today?';
const GATHER_TIMEOUT_SEC = 8;
const GATHER_LANGUAGE = 'en-US';

// Tiny helper to safely build XML
function twiml(strings: TemplateStringsArray, ...values: any[]) {
  const esc = (v: any) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  let out = '';
  strings.forEach((s, i) => { out += s + (i < values.length ? esc(values[i]) : ''); });
  return out;
}

function getBaseUrl(req: NextApiRequest) {
  // Prefer x-forwarded-* (Vercel/Proxies), else fall back to req.headers.host
  const proto =
    (req.headers['x-forwarded-proto'] as string) ||
    (req.headers['x-forwarded-protocol'] as string) ||
    'https';
  const host =
    (req.headers['x-forwarded-host'] as string) ||
    (req.headers['x-forwarded-server'] as string) ||
    req.headers.host ||
    '';
  return `${proto}://${host}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method Not Allowed');
  }

  const baseUrl = getBaseUrl(req);
  const actionUrl = `${baseUrl}/api/voice/twilio/continue`;

  const xml = twiml`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${DEFAULT_GREETING}</Say>
  <Gather input="speech"
          action="${actionUrl}"
          method="POST"
          language="${GATHER_LANGUAGE}"
          speechTimeout="${GATHER_TIMEOUT_SEC}">
    <Say voice="alice">I’m listening.</Say>
  </Gather>
  <Redirect method="POST">${actionUrl}</Redirect>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(xml);
}
