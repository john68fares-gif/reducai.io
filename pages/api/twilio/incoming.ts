// pages/api/voice/twilio/incoming.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Always return valid TwiML so calls never fail, even before your agent is wired up.
  const { greeting = 'Your Reduc A I test line is live. Say something after the beep.' } =
    (req.method === 'GET' ? req.query : req.body) as Record<string, string>;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-US">${escapeXml(greeting)}</Say>
  <Pause length="1"/>
  <Record maxLength="10" playBeep="true"/>
  <Hangup/>
</Response>`;

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.status(200).send(twiml);
}

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
