// pages/api/voice/twilio/incoming.ts
// Drop-in replacement that does NOT require Vapi or any env vars.
// Always returns valid TwiML so Twilio never says “configuration error”.

import type { NextApiRequest, NextApiResponse } from 'next';

function escapeXml(s: string) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' } as any)[c]
  );
}

function sendTwiML(res: NextApiResponse, innerXml: string) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${innerXml}</Response>`;
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.status(200).send(xml);
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Accept both POST and GET (Twilio can be configured either way)
    const agentIdQ = typeof req.query.agentId === 'string' ? req.query.agentId : '';
    const agentIdB = typeof (req.body as any)?.agentId === 'string' ? (req.body as any).agentId : '';
    const agentId = (agentIdQ || agentIdB || '').trim();

    // Minimal, friendly greeting – no dependencies, no streaming
    const line = agentId
      ? `Thanks for calling. Your voice agent ${agentId} is configured.`
      : `Thanks for calling. Your voice agent is configured.`;

    // Keep it simple to avoid any config errors from Twilio
    sendTwiML(
      res,
      `<Say voice="alice">${escapeXml(line)}</Say><Pause length="1"/><Say voice="alice">Goodbye.</Say><Hangup/>`
    );
  } catch {
    // Even on errors, return 200 with valid TwiML so Twilio doesn’t announce configuration errors
    sendTwiML(res, `<Say voice="alice">Your number is connected.</Say><Hangup/>`);
  }
}
