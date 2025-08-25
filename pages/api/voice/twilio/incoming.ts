import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Use a *dynamic* import for `twilio` so the bundler doesn't choke during Vercel build.
 * (Top-level ESM import of twilio can fail during static analysis.)
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const twilio = await import('twilio');
  const VoiceResponse = (twilio as any).twiml.VoiceResponse as typeof twilio.twiml.VoiceResponse;

  const twiml = new VoiceResponse();
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
