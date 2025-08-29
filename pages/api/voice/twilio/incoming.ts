// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { xml2json } from 'xml-js'; // dev dep not required; only for debugging if you want
// ^ You can remove the import above if you don’t need it. It’s not used in the handler.

type Data = string; // TwiML XML string

/**
 * IMPORTANT:
 * - This webhook must NOT speak your system prompt.
 * - It gives a neutral greeting, then hands control to /api/voice/twilio/continue
 *   which will run the AI (we’ll add that next).
 *
 * How it works (now):
 *   1) Answer call
 *   2) Say a short neutral greeting (configurable via env)
 *   3) Gather speech for up to 8 seconds
 *   4) Send the transcript to /api/voice/twilio/continue (POST), which should
 *      generate the AI reply and return more TwiML (we’ll provide that file next).
 */

const DEFAULT_GREETING =
  process.env.AGENT_GREETING ||
  'Hi, thanks for calling. How can I help you today?';

const GATHER_TIMEOUT_SEC = Number(process.env.GATHER_TIMEOUT_SEC || 8);
const GATHER_LANGUAGE = process.env.GATHER_LANGUAGE || 'en-US';

// Public URL of your deployment (no trailing slash).
// Example: https://reducai-io-eq4t-6uk48e7ek-john68fares-3902s-projects.vercel.app
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || '';

/**
 * Small helper to build TwiML safely.
 */
function twiml(strings: TemplateStringsArray, ...values: any[]) {
  const esc = (v: any) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  let out = '';
  strings.forEach((s, i) => {
    out += s + (i < values.length ? esc(values[i]) : '');
  });
  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  // Twilio can hit via GET (for quick checks) or POST (real webhooks)
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method Not Allowed');
  }

  // Validate base URL for the follow-up action
  if (!PUBLIC_BASE_URL) {
    // Fail fast with a clear message shown as TwiML to the caller.
    const explain = 'Configuration error: PUBLIC_BASE_URL missing.';
    const xml = twiml`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${explain}</Say>
  <Hangup/>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(xml);
  }

  // Where the speech result goes:
  const actionUrl = `${PUBLIC_BASE_URL}/api/voice/twilio/continue`;

  // Neutral greeting + gather. We do NOT inject any system prompt here.
  // The real AI prompt will be used server-side in /continue.
  const xml = twiml`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${DEFAULT_GREETING}</Say>
  <Gather input="speech" action="${actionUrl}" method="POST" language="${GATHER_LANGUAGE}" speechTimeout="${GATHER_TIMEOUT_SEC}">
    <Say voice="alice">I’m listening.</Say>
  </Gather>
  <Redirect method="POST">${actionUrl}</Redirect>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(xml);
}
