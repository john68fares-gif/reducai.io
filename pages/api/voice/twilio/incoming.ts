// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * ENV you must set on Vercel project (Project Settings → Environment Variables)
 * - VAPI_API_KEY:     Your Vapi server (secret) API key
 * - VAPI_WS_BASE:     Optional. Defaults to "wss://api.vapi.ai"
 *
 * How it works:
 *  - Twilio webhook hits this endpoint on inbound call
 *  - We read ?agentId from the query string
 *  - We respond with TwiML that opens a Twilio <Connect><Stream> to Vapi
 *  - Auth is passed in headers via Twilio's stream "content-type" trick with query params
 *
 * NOTE: Do NOT put your Vapi key in the client. This route runs server-side only.
 */

function twiml(xml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`;
}

function sayAndHangup(msg: string) {
  // Short, precise voice error so you immediately know what's wrong on a live call.
  const safe = msg.replace(/[<>&]/g, ' ');
  return twiml(
    `<Say voice="alice">${safe}</Say><Hangup/>`
  );
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const agentId = (req.query.agentId || req.body?.agentId || '').toString().trim();
  const vapiKey = process.env.VAPI_API_KEY?.trim();
  const wsBase  = (process.env.VAPI_WS_BASE || 'wss://api.vapi.ai').trim();

  if (!agentId) {
    return res
      .status(200)
      .setHeader('Content-Type', 'text/xml')
      .send(sayAndHangup('Configuration error: missing agent id.'));
  }

  if (!vapiKey) {
    return res
      .status(200)
      .setHeader('Content-Type', 'text/xml')
      .send(sayAndHangup('Server configuration error: missing Vapi API key.'));
  }

  /**
   * We connect Twilio’s bidirectional media stream to Vapi.
   * Auth is carried as query params (Vapi validates them server-side).
   * You can safely rotate VAPI_API_KEY anytime from your Vercel env.
   *
   * IMPORTANT: We do NOT add any <Say> lines here; the assistant will start promptly.
   */
  const streamUrl = `${wsBase}/v1/twilio?assistantId=${encodeURIComponent(
    agentId
  )}&apiKey=${encodeURIComponent(vapiKey)}`;

  // Optional: pass caller/callee metadata (useful in Vapi rules/tools)
  // Twilio sends From and To in the form +E164
  const from = (req.body?.From || '').toString();
  const to = (req.body?.To || '').toString();

  const startParams: Record<string, string> = {};
  if (from) startParams['from'] = from;
  if (to)   startParams['to']   = to;

  // Turn the params into <Parameter/> tags
  const paramsXml = Object.entries(startParams)
    .map(([name, value]) => `<Parameter name="${name}" value="${value}"/>`)
    .join('');

  const xml =
    `<Connect>
        <Stream url="${streamUrl}">
          ${paramsXml}
        </Stream>
     </Connect>`;

  res
    .status(200)
    .setHeader('Content-Type', 'text/xml')
    .send(twiml(xml));
}
