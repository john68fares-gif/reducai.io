import type { NextApiRequest, NextApiResponse } from 'next';
import Twilio from 'twilio';

/**
 * Minimal “call works” webhook:
 * - Says a disclosure
 * - Says a short greeting
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const twiml = new Twilio.twiml.VoiceResponse();

  twiml.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    'This call may be recorded to capture your details.'
  );
  twiml.pause({ length: 1 });
  twiml.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    'Hello. Your voice agent is connected.'
  );

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml.toString());
}
