// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * This endpoint returns TwiML that:
 *  1) DOES NOT speak your system prompt.
 *  2) Optionally says a short "connecting" line (remove if you want total silence).
 *  3) Connects the call to your realtime voice agent over a WebSocket stream.
 *
 * Expected query params (provided by your app when you "Attach Number"):
 *   - agentId: string (your build/agent identifier)
 * Optional:
 *   - greet: "0" | "1"  (default "1": say a short line; set to "0" for no greeting)
 */

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    // Twilio sends POST. Return method not allowed for anything else.
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const agentId = (req.query.agentId as string) || '';
  const greet = (req.query.greet as string) ?? '1';

  // --- IMPORTANT ---
  // Point this to your realtime assistant WS endpoint.
  // If you’re using Vapi, this is typically their public stream URL.
  // If you proxy through your own WS, put that URL here instead.
  const VAPI_WS_URL =
    process.env.VAPI_WS_URL ||
    'wss://api.vapi.ai/stream'; // replace if you use a different provider

  // Never expose secrets in query params. If your provider needs a public key,
  // use a PUBLIC key only (or sign a short-lived token server-side).
  const PUBLIC_KEY = process.env.VAPI_PUBLIC_KEY || '';

  // Build the WS URL with safe public params only.
  const ws = new URL(VAPI_WS_URL);
  if (agentId) ws.searchParams.set('assistantId', agentId);
  if (PUBLIC_KEY) ws.searchParams.set('publicKey', PUBLIC_KEY);

  // Minimal TwiML.
  // DO NOT inject the system prompt anywhere in <Say>.
  // The prompt belongs inside your assistant config on the provider side.
  const parts: string[] = [];
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  parts.push(`<Response>`);

  if (greet !== '0') {
    parts.push(
      `<Say voice="Polly.Joanna" language="en-US">Thanks for calling. Connecting you now.</Say>`
    );
    // A short pause helps avoid clipping the first streamed audio.
    parts.push(`<Pause length="1" />`);
  }

  // Twilio bidirectional media stream. Twilio will connect to THIS url.
  // Your provider receives audio there and handles the LLM + TTS/ASR.
  parts.push(`<Connect>`);
  parts.push(`  <Stream url="${ws.toString().replace(/&/g, '&amp;')}"></Stream>`);
  parts.push(`</Connect>`);

  parts.push(`</Response>`);
  const xml = parts.join('');

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(xml);
}
