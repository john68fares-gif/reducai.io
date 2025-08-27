import type { NextApiRequest, NextApiResponse } from 'next';
import twilio from 'twilio';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const twiml = new (twilio as any).twiml.VoiceResponse();
  const speech = (req.body?.SpeechResult || '').trim();

  if (speech) {
    twiml.say({ voice: 'Polly.Matthew' }, `Thanks, I heard: ${speech}. We will get back to you shortly.`);
  } else {
    twiml.say({ voice: 'Polly.Matthew' }, 'Thanks for calling. Goodbye.');
  }

  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml.toString());
}
